@echo off
rem Installs the Demo Annotation panel for the current Windows user. Run it again to update.
setlocal
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.demopkg.annotation"

echo Installing the Demo Annotation panel for Illustrator...
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy "%~dp0CSXS" "%DEST%\CSXS\" /e /i /q /y >nul
xcopy "%~dp0app" "%DEST%\app\" /e /i /q /y >nul
for %%F in (index.html host.js qb.js demo_account.js demo_gate.js .debug) do copy /y "%~dp0%%F" "%DEST%\" >nul
if not exist "%DEST%\CSXS\manifest.xml" (
  echo.
  echo Something went wrong: the files were not copied to
  echo   %DEST%
  pause
  exit /b 1
)

rem The panel is not signed by Adobe, so Illustrator only loads it with this per-user setting turned on.
for %%V in (9 10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

echo.
echo Done. Close and reopen Illustrator, then choose
echo   Window ^> Extensions (Legacy) ^> Demo Annotation
echo If the panel says to sign in, install and open the Demo Account panel first.
echo.
pause
