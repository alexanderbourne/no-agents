/**
 * /api/admin/patch.js
 *
 * Applies a find-and-replace patch to a file in GitHub, triggering auto-deploy.
 * Accepts GET so Claude can call it via web_fetch without needing POST.
 *
 * GET params:
 *   password  — must match ADMIN_PASSWORD env var
 *   path      — file path in repo (e.g. api/voice/respond.js)
 *   old       — text to find (URL-encoded)
 *   new       — text to replace with (URL-encoded)
 *   msg       — optional commit message
 *
 * For full multi-file commits use /api/admin/push (POST).
 */

const OWNER  = process.env.GITHUB_OWNER  || 'alexanderbourne';
const REPO   = process.env.GITHUB_REPO   || 'no-agents';
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
  const { password, path: filePath, old: findStr, new: replaceStr, msg } = req.query;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!filePath || !findStr || replaceStr === undefined) {
    return res.status(400).json({ error: 'Missing required params: path, old, new' });
  }

  try {
    // Get current file from GitHub
    const fileRes = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`);
    const fileData = await fileRes.json();
    if (!fileData.content) throw new Error(`File not found: ${filePath} — ${JSON.stringify(fileData)}`);

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const newContent = currentContent.split(findStr).join(replaceStr);

    if (newContent === currentContent) {
      return res.json({ success: true, changed: false, message: 'No changes needed' });
    }

    // Commit the updated file
    const commitRes = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: msg || `patch: ${filePath}`,
        content: Buffer.from(newContent).toString('base64'),
        sha: fileData.sha,
        branch: BRANCH,
      }),
    });
    const committed = await commitRes.json();
    if (!committed.commit) throw new Error(`Commit failed: ${JSON.stringify(committed)}`);

    res.json({ success: true, changed: true, commit: committed.commit.sha, file: filePath });
  } catch (err) {
    console.error('[patch] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
