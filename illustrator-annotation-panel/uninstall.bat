@echo off
rem Removes the Demo Annotation panel for the current Windows user.
setlocal
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.demopkg.annotation"
if exist "%DEST%" rmdir /s /q "%DEST%"
echo The Demo Annotation panel was removed. Restart Illustrator.
echo (The setting that lets Illustrator load unsigned panels was left on, in case another panel needs it.)
pause
