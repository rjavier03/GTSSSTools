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

    :: Reset field counter
    set i=0

    :: Extract 3rd field (PO number)
    for %%A in (!name!) do (
        set /a i+=1
        if !i! EQU 3 set "po=%%A"
    )

    :: Build new filename
    set "newname=%prefix%_!po!_!counter!!ext!"

    :: Rename file first
    ren "%%F" "!newname!"

    :: Move to new folder
    move "!newname!" "%prefix%\"

    set /a counter+=1
)

echo Done processing PDFs.
pause