@echo off
echo Deploying meta-ads-insights proxy to Vercel...
cd /d "C:\Users\Alexa\Claude\Projects\No-Agents"
set VERCEL_TOKEN=vcp_06eEUySL8XEM952dwPIFUir40HEk5IPyulR5Jvxiwe8xilNILh4DT3Ty
vercel deploy --prod --token %VERCEL_TOKEN% --yes
echo.
echo Done. Check Vercel dashboard if you see any errors above.
pause
