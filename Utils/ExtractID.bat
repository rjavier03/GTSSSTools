@echo off
setlocal

set "outFile=DocumentDetails.txt"

echo [LOG] Starting Text-Based Scan...

:: 1. LinkedInternalID
echo LinkedInternalID > "%outFile%"
powershell -NoProfile -Command "Get-ChildItem *.confirmed | ForEach-Object { $content = Get-Content $_.FullName -Raw; if ($content -match '<UNCFolderPath>(.*?)</UNCFolderPath>') { $path = $matches[1]; ($path -split '\\')[-1].Split('_')[1] } }" >> "%outFile%"

echo. >> "%outFile%"
echo ============ >> "%outFile%"
echo. >> "%outFile%"

:: 2. InternalID
echo InternalID >> "%outFile%"
powershell -NoProfile -Command "Get-ChildItem *.confirmed | ForEach-Object { $content = Get-Content $_.FullName -Raw; if ($content -match '<InternalID>(.*?)</InternalID>') { $matches[1] } }" >> "%outFile%"

echo. >> "%outFile%"
echo ============ >> "%outFile%"
echo. >> "%outFile%"

:: 3. DocID
echo Doc >> "%outFile%"
powershell -NoProfile -Command "Get-ChildItem *.confirmed | ForEach-Object { $content = Get-Content $_.FullName -Raw; if ($content -match '<DocID>(.*?)</DocID>') { $matches[1] } }" >> "%outFile%"

echo [DONE] Check %outFile%

:: =========================
:: DELETE CONFIRMED FILES
:: =========================
echo [LOG] Deleting .confirmed files...
del /q *.confirmed

echo [DONE] Cleanup completed.
pause