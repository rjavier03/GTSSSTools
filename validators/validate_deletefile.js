// validators/validate_deletefile.js
window.validators.push(function validate_deletefile(lines, raw, issues) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for deleteFile usage
        if (/YB_V2Util::deleteFile\(/.test(line)) {
            let hasIsFileExist = false;

            // Look backward a few lines to see if there is a preceding isFileExist check
            for (let j = i - 5; j < i; j++) { // look back max 5 lines
                if (j >= 0 && /YB_V2Util::isFileExist\(/.test(lines[j])) {
                    hasIsFileExist = true;
                    break;
                }
            }

            if (!hasIsFileExist) {
                issues.push({
                    type: "deleteFile without isFileExist",
                    line: i + 1,
                    snippet: line,
                    detail: "YB_V2Util::deleteFile must be preceded by YB_V2Util::isFileExist check"
                });
            }
        }
    }
});
