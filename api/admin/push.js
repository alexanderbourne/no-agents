/**
 * /api/admin/push.js
 *
 * Commits file changes to GitHub, which triggers Vercel auto-deploy.
 * This lets Claude deploy code without any manual terminal commands.
 *
 * POST body (JSON):
 *   { password, message, files: [{ path, content }] }
 *
 * Required env vars (set in Vercel dashboard):
 *   ADMIN_PASSWORD  — already set
 *   GITHUB_TOKEN    — personal access token with repo write scope
 *   GITHUB_OWNER    — alexanderbourne
 *   GITHUB_REPO     — no-agents
 *   GITHUB_BRANCH   — main
 */

const OWNER = process.env.GITHUB_OWNER || 'alexanderbourne';
const REPO  = process.env.GITHUB_REPO  || 'no-agents';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

function ghFetch(path, opts = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.body?.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message = 'Auto-deploy by Claude', files = [] } = req.body;
  if (!files.length) return res.status(400).json({ error: 'No files provided' });

  try {
    // 1. Get current HEAD SHA
    const refRes = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    const ref = await refRes.json();
    if (ref.message) throw new Error(`GitHub ref error: ${ref.message}`);
    const headSha = ref.object.sha;

    // 2. Get the tree SHA from the current commit
    const commitRes = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits/${headSha}`);
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each changed file
    const treeItems = await Promise.all(files.map(async ({ path: filePath, content }) => {
      const blobRes = await ghFetch(`/repos/${OWNER}/${REPO}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content, encoding: 'utf-8' }),
      });
      const blob = await blobRes.json();
      if (!blob.sha) throw new Error(`Blob creation failed for ${filePath}: ${JSON.stringify(blob)}`);
      return { path: filePath, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    // 4. Create a new tree with the updated files
    const treeRes = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    const newTree = await treeRes.json();
    if (!newTree.sha) throw new Error(`Tree creation failed: ${JSON.stringify(newTree)}`);

    // 5. Create the commit
    const newCommitRes = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
    });
    const newCommit = await newCommitRes.json();
    if (!newCommit.sha) throw new Error(`Commit creation failed: ${JSON.stringify(newCommit)}`);

    // 6. Update the branch to point to the new commit
    const updateRes = await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    });
    const updated = await updateRes.json();

    res.json({
      success: true,
      commit: newCommit.sha,
      message: newCommit.message,
      ref: updated.ref,
    });
  } catch (err) {
    console.error('[push] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
