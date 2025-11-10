window.validators.push(function validate_party_and_arrays(lines, raw, issues, ctx) {
  // =================== PARTY INDEX RULE ===================
  const getIdxCall = /([A-Za-z_][A-Za-z0-9_]*)->partyDetails->getPartyByQualifierIndex\s*\(\s*Party::([A-Za-z_]+)\s*\)/;
  const assignParty = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[A-Za-z_][A-Za-z0-9_]*->header->partyDetails->party\s*\[\s*idx\s*\]/;
  const addPartyCall = /->partyDetails->addParty\s*\(/;
  const partyUse = /\b([A-Za-z_][A-Za-z0-9_]*)->/;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const match = ln.match(getIdxCall);
    if (!match) continue;

    const varName = match[1];
    const qualifier = match[2];

    let assignedParty = null;
    let idxIfStart = -1, idxIfEnd = -1;
    let elseAddPartyFound = false;
    let onlyAssignInsideIf = false;

    // --- Find "if (idx > -1)" and determine its block
    for (let j = i + 1; j < lines.length; j++) {
      const lineTrim = lines[j].trim();
      if (/^if\s*\(\s*idx\s*>\s*-?1\s*\)/.test(lineTrim)) {
        idxIfStart = j;

        if (lineTrim.includes("{")) {
          // multi-line if with braces
          let braceCount = 0;
          for (let k = j; k < lines.length; k++) {
            if (lines[k].includes("{")) braceCount++;
            if (lines[k].includes("}")) braceCount--;
            if (braceCount === 0 && k > j) {
              idxIfEnd = k;
              break;
            }
          }
        } else {
          // single-line if without braces
          idxIfEnd = j + 1;
        }

        break;
      }
    }
    if (idxIfStart === -1 || idxIfEnd === -1) continue;

    // --- Analyze inside the if-block
    let bodyLines = [];
    for (let j = idxIfStart + 1; j < idxIfEnd; j++) {
      const lineTrimmed = lines[j].trim();
      bodyLines.push(lineTrimmed);
      const m2 = lines[j].match(assignParty);
      if (m2) assignedParty = m2[1];
    }

    // Single-line if without braces: include the next line as body
    if (bodyLines.length === 0 && idxIfEnd === idxIfStart + 1) {
      const singleLine = lines[idxIfStart + 1] ? lines[idxIfStart + 1].trim() : "";
      if (singleLine) {
        bodyLines.push(singleLine);
        const m2 = singleLine.match(assignParty);
        if (m2) assignedParty = m2[1];
      }
    }

    const nonEmpty = bodyLines.filter(l => l && l !== "{" && l !== "}").length;
    const assignCount = bodyLines.filter(l => assignParty.test(l)).length;

    // Only flag if there is exactly one assignment and nothing else
    if (nonEmpty === 1 && assignCount === 1) onlyAssignInsideIf = true;

    // --- Look for "else { addParty(...) }" after the if-block
    for (let j = idxIfEnd; j < Math.min(lines.length, idxIfEnd + 10); j++) {
      const trimmed = lines[j].trim();
      if (/^else\b/.test(trimmed)) {
        for (let k = j; k < Math.min(lines.length, j + 8); k++) {
          if (addPartyCall.test(lines[k])) {
            elseAddPartyFound = true;
            break;
          }
        }
        break;
      }
    }

    // --- ERROR RULES ---
    if (!elseAddPartyFound && onlyAssignInsideIf) {
      issues.push({
        type: "Missing else addParty",
        line: idxIfStart + 1,
        snippet: lines[idxIfStart].trim(),
        detail: `The idx-check for Party::${qualifier} only assigns the party pointer without an else { addParty(...) }.` 
      });
    }
  }

  // =================== GENERIC INDEX-GUARD RULE ===================
  const indexAccessPattern = /\b([A-Za-z_][A-Za-z0-9_]*)->([A-Za-z_]+)\s*\[\s*(\d+)\s*\]/g;

  const arrayCountMap = {
    description: "descNum",
    charge: "chargeNum",
    contact: "contactNum",
    item: "itemNum",
    note: "noteNum",
    tax: "taxNum"
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    indexAccessPattern.lastIndex = 0;
    let match;

    while ((match = indexAccessPattern.exec(ln)) !== null) {
      const obj = match[1];
      const prop = match[2];
      const idx = match[3];

      let hasGuard = false;
      for (let j = i - 1; j >= 0; j--) {
        const lineTrim = lines[j].trim();
        if (/^\s*if\s*\(/.test(lineTrim)) {
          const expectedNumProp = arrayCountMap[prop] || (prop + "Num");
          if (new RegExp(`\\b${obj}->${expectedNumProp}\\s*>\\s*-?1`).test(lineTrim)) {
            hasGuard = true;
          }
          break;
        }
      }

      if (!hasGuard) {
        issues.push({
          type: "Unprotected indexed access",
          line: i + 1,
          snippet: ln.trim(),
          detail: `Array ${obj}->${prop}[${idx}] is used without a preceding guard: if (${obj}->${arrayCountMap[prop] || (prop + "Num")} > -1).`
        });
      }
    }
  }
});
