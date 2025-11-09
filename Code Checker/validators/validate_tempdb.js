// validators/validate_tempdb.js
window.validators.push(function validate_tempdb(lines, raw, issues) {
  const safeVars = new Set();

  // 1️⃣ First pass: collect all variables assigned from getDBLookupSettings
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const assignMatch = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:\*?\s*)=\s*.*getDBLookupSettings\s*\(/i);
    if (assignMatch) {
      safeVars.add(assignMatch[1].trim());
    }
  }

  // 2️⃣ Second pass: check all tempDBSettings accesses
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // Match array access
    const accessMatch = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\[/);
    if (accessMatch) {
      const varName = accessMatch[1].trim();

      // If the variable is tempDBSettings but not in safeVars, flag it
      if (varName === 'tempDBSettings' && !safeVars.has(varName)) {
        issues.push({
          type: 'tempDBSettings use',
          line: i + 1,
          snippet: ln.trim(),
          detail: 'tempDBSettings must be assigned from getDBLookupSettings() before use'
        });
      }
    }
  }
});
