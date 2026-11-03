@echo off
rem Removes the Demo Account panel and signs this computer out of every Demo panel for the current Windows user.
setlocal
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.demopkg.account"
if exist "%DEST%" rmdir /s /q "%DEST%"
if exist "%APPDATA%\Demo Packaging\account" rmdir /s /q "%APPDATA%\Demo Packaging\account"
if exist "%APPDATA%\Demo Packaging\annotation-panel" rmdir /s /q "%APPDATA%\Demo Packaging\annotation-panel"
echo The Demo Account panel was removed, and this computer is signed out of the Demo panels. Restart Illustrator.
echo (The setting that lets Illustrator load unsigned panels was left on, in case another panel needs it.)
pause
