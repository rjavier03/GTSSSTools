window.validators.push(function validate_array(lines, raw, issues, ctx) {
  const access = /([A-Za-z_][A-Za-z0-9_]*)(?:->[\w_]+|\.[\w_]+)*\s*\[\s*([^\]]+)\s*\]/g;
  const safeVars = new Set();

  // collect safe vars from getDBLookupSettings
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const assignMatch = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:\*?\s*)=\s*.*getDBLookupSettings\s*\(/);
    if (assignMatch) safeVars.add(assignMatch[1].trim());
  }

  // detect array accesses
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    access.lastIndex = 0;
    let m;
    while ((m = access.exec(ln))) {
      const arr = m[1].trim();
      const idx = m[2].trim();

      if (/getDBLookupSettings/.test(arr)) continue;
      if (safeVars.has(arr)) continue;

      if (/^\d+$/.test(idx) && !/Num|Count|size|length/.test(ln)) {
        issues.push({
          type: "Array index literal",
          line: i + 1,
          snippet: ln.trim(),
          detail: `Array "${arr}" accessed with numeric index [${idx}] without bounds check`
        });
      }
    }
  }

  // --- Check getPartyByQualifierIndex usage ---
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const match = ln.match(/([A-Za-z_][A-Za-z0-9_]*)->partyDetails->getPartyByQualifierIndex\s*\(\s*Party::([A-Za-z_]+)\s*\)/);
    if (match) {
      const varName = match[1];
      const qualifier = match[2];

      // Look ahead for if/else structure using this index
      let hasElseAddParty = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
        const nextLine = lines[j].trim();
        if (/else\s*{/.test(nextLine) || /else\b/.test(nextLine)) {
          // check if addParty is inside this else block
          for (let k = j; k < Math.min(lines.length, j + 5); k++) {
            if (lines[k].includes(`${varName}->partyDetails->addParty`)) {
              hasElseAddParty = true;
              break;
            }
          }
          break;
        }
      }

      if (!hasElseAddParty) {
        issues.push({
          type: "Missing else addParty",
          line: i + 1,
          snippet: ln.trim(),
          detail: `The call ${varName}->partyDetails->getPartyByQualifierIndex(Party::${qualifier}) does not have a corresponding else { addParty(...) } block.`
        });
      }
    }
  }
});
