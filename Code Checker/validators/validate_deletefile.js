// validators/validate_deletefile.js
window.validators.push(function validate_deletefile(lines, raw, issues) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1️⃣ Detect any deleteFile call
        const match = line.match(/YB_V2Util::deleteFile\s*\(\s*([^)]+)\s*\)/);
        if (match) {
            const variableName = match[1].trim();

            // 2️⃣ Console log every deleteFile call
            console.log(`[deleteFile] Line ${i + 1}: ${line.trim()} (variable: ${variableName})`);

            let foundIsFileExist = false;

            // 3️⃣ Look back 10 lines for isFileExist of the same variable
            for (let j = Math.max(0, i - 10); j < i; j++) {
                if (new RegExp(`YB_V2Util::isFileExist\\s*\\(\\s*${variableName}\\s*\\)`).test(lines[j])) {
                    foundIsFileExist = true;
                    break;
                }
            }

            // 4️⃣ Raise issue if no isFileExist found
            if (!foundIsFileExist) {
                issues.push({
                    type: "deleteFile without isFileExist",
                    line: i + 1,
                    snippet: line.trim(),
                    detail: `YB_V2Util::deleteFile(${variableName}) must be preceded by YB_V2Util::isFileExist(${variableName}).`
                });
            }
        }
    }
});
