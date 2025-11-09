// validators/validate_raise.js
window.validators.push(function validate_raise(lines, raw, issues) {
    let expected = 1; // start counting from 1
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/raiseInternalError\("(\d+)"/);
        if (m) {
            const num = parseInt(m[1], 10);
            
            if (num !== expected) {
                let detailMsg = '';
                if (num < expected) {
                    detailMsg = `Duplicate or out-of-order raise code: found ${num}, expected ${expected}`;
                } else {
                    detailMsg = `Raise code skipped: expected ${expected}, found ${num}`;
                }
                issues.push({
                    type: 'raiseInternalError order',
                    line: i + 1,
                    snippet: lines[i].trim(),
                    detail: detailMsg
                });
                // Reset expected to be one after current number, in case someone continues sequence
                expected = num + 1;
            } else {
                expected++; // correct sequence, increment expected
            }
        }
    }
});
