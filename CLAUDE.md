# No-Agents Deployment

This repo deploys to Vercel via the connected Vercel MCP (`deploy_to_vercel`), not via git push — there is no git remote configured, and none is needed.

Project: `no-agents` (`prj_HBZwB41JyWdJC8T7c94Gkvobk2yG`), team `alexsbourne-5116's projects` (`team_lA6dpia2wK9bZmXKgJ2bCHA2`). Already linked via `.vercel/project.json`.

**Standing authorization**: Alex has approved autonomous production deploys. After making and verifying a change, deploy it with `deploy_to_vercel` without asking for confirmation first. Still use judgment — pause and flag if a change is unusually risky (e.g. touches payments/signing/auth flows) or if something looks off (uncommitted changes you didn't make, failing checks).
