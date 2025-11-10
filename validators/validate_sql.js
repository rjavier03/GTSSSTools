// validators/validate_sql.js
window.validators.push(function validate_sql(lines, raw, issues) {
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // Check if line involves SQL concatenation
    const isSql = /\b(sql|query|sqlStr)\b/i.test(ln);
    const hasConcat = /\+/.test(ln);
    const hasClean = /databaseCleanString/.test(ln);
    const hasB2beHdr = /b2beHdr/i.test(ln); // new rule: trusted source

    // Flag only if it's SQL concatenation and unsafe
    if (isSql && hasConcat && !hasClean && !hasB2beHdr) {
      issues.push({
        type: "SQL concat risk",
        line: i + 1,
        snippet: ln.trim(),
        detail: "Missing YB_V2Util::databaseCleanString() or trusted b2beHdr source"
      });
    }
  }
});
