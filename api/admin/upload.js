/**
 * /api/admin/upload.js
 *
 * Creates or updates a file in GitHub via GET request (Claude can call this
 * via web_fetch without needing POST). Used to seed files that were deployed
 * via Vercel CLI but never committed to GitHub.
 *
 * GET params:
 *   password  — must match ADMIN_PASSWORD env var
 *   path      — file path in repo (e.g. api/voice/respond.js)
 *   content   — base64-encoded file content
 *   msg       — optional commit message
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
  const { password, path: filePath, content, msg } = req.query;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!filePath || !content) {
    return res.status(400).json({ error: 'Missing required params: path, content' });
  }

  try {
    // Check if file already exists (to get its SHA for updates)
    let existingSha;
    const checkRes = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`);
    if (checkRes.ok) {
      const existing = await checkRes.json();
      existingSha = existing.sha;
    }

    // Create or update the file
    const body = {
      message: msg || `upload: ${filePath}`,
      content, // already base64
      branch: BRANCH,
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const result = await putRes.json();

    if (!result.commit) throw new Error(`GitHub error: ${JSON.stringify(result)}`);

    res.json({
      success: true,
      action: existingSha ? 'updated' : 'created',
      file: filePath,
      commit: result.commit.sha,
    });
  } catch (err) {
    console.error('[upload] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
