@echo off
echo ============================================
echo  No-Agents - Deploying to production
echo ============================================
echo.
cd /d "C:\Users\Alexa\Claude\Projects\No-Agents"
echo Working in: %CD%
echo.
echo Committing local changes to git (local history only)...
git add -A
git commit -m "SEO: real routes + route-meta SSR, ~900 QLD suburb pages (serverless), dynamic sitemap, robots.txt"
echo.
echo Deploying to Vercel production...
call npx vercel deploy --prod --yes
echo.
echo ============================================
echo  Done! Check: https://www.no-agents.com.au/qld-suburbs
echo ============================================
pause
