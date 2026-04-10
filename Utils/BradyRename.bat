@echo off
setlocal enabledelayedexpansion

:: Ask for folder / filename prefix
set /p "prefix=Enter folder/filename prefix: "

:: Create new folder
if not exist "%prefix%" mkdir "%prefix%"

:: Counter for auto-increment
set counter=1

:: Loop ONLY PDF files in current folder
for %%F in (*.pdf) do (
    set "name=%%~nF"
    set "ext=%%~xF"

    :: Use full filename as-is (no splitting)
    set "newname=%prefix%_!name!_!counter!!ext!"

    :: Rename file first
    ren "%%F" "!newname!"

    :: Move to new folder
    move "!newname!" "%prefix%\"

    set /a counter+=1
)

echo Done processing PDFs.
pause