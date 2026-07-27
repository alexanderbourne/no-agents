@echo off
echo Deploying meta-ads-insights proxy to Vercel...
cd /d "C:\Users\Alexa\Claude\Projects\No-Agents"
if not defined VERCEL_TOKEN goto :missingtoken
vercel deploy --prod --token %VERCEL_TOKEN% --yes
echo.
echo Done. Check Vercel dashboard if you see any errors above.
pause
exit /b 0

:missingtoken
echo ERROR: VERCEL_TOKEN environment variable is not set.
echo Set it once under System Properties, Environment Variables.
echo Never hardcode the token in this file.
pause
exit /b 1
