window.validators.push(function validate_party_and_arrays(lines, raw, issues, ctx) {
  // =================== PARTY INDEX RULE ===================
  const getIdxCall = /([A-Za-z_][A-Za-z0-9_]*)->partyDetails->getPartyByQualifierIndex\s*\(\s*Party::([A-Za-z_]+)\s*\)/;
  const assignParty = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[A-Za-z_][A-Za-z0-9_]*->header->partyDetails->party\[idx\]/;
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

    // --- Find "if (idx > -1)"
    for (let j = i + 1; j < lines.length; j++) {
      if (/\bif\s*\(\s*idx\s*>\s*-?1\s*\)/.test(lines[j])) {
        idxIfStart = j;
        let braceCount = 0;
        for (let k = j; k < lines.length; k++) {
          if (lines[k].includes("{")) braceCount++;
          if (lines[k].includes("}")) braceCount--;
          if (braceCount === 0 && k > j) {
            idxIfEnd = k;
            break;
          }
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

    const nonEmpty = bodyLines.filter(l => l && l !== "{" && l !== "}").length;
    const assignCount = bodyLines.filter(l => assignParty.test(l)).length;
    if (nonEmpty === assignCount && assignCount > 0) onlyAssignInsideIf = true;

    // --- Look for "else { addParty(...) }"
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
      continue;
    }

    if (!elseAddPartyFound && assignedParty) {
      for (let j = idxIfEnd + 1; j < Math.min(lines.length, i + 30); j++) {
        const useMatch = lines[j].match(partyUse);
        if (useMatch && useMatch[1] === assignedParty) {
          issues.push({
            type: "Missing else addParty",
            line: i + 1,
            snippet: ln.trim(),
            detail: `Variable "${assignedParty}" (from ${varName}->partyDetails->getPartyByQualifierIndex(Party::${qualifier})) is used outside its idx-check without an else { addParty(...) }.`
          });
          break;
        }
      }
    }
  }

  // =================== GENERIC INDEX-GUARD RULE ===================
  const indexAccessPattern = /\b([A-Za-z_][A-Za-z0-9_]*)->([A-Za-z_]+)\s*\[\s*(\d+)\s*\]/g;

  // Mapping known array properties to their count variables
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

      console.log(`Array access found: ${obj}->${prop}[${idx}] at line ${i + 1}`);

      // --- Check previous lines until it finds a matching guard
      let hasGuard = false;
      for (let j = i - 1; j >= 0; j--) {
        const lineTrim = lines[j].trim();
        if (/^\s*if\s*\(/.test(lineTrim)) {
          // Determine expected count property
          const expectedNumProp = arrayCountMap[prop] || (prop + "Num");
          if (new RegExp(`\\b${obj}->${expectedNumProp}\\s*>\\s*-?1`).test(lineTrim)) {
            hasGuard = true;
          }
          break; // stop at first if-condition upwards
        }
      }

      if (!hasGuard) {
        issues.push({
          type: "Unprotected indexed access",
          line: i + 1,
          snippet: ln.trim(),
          detail: `Array ${obj}->${prop}[${idx}] is used without a preceding guard: if (${obj}->${
            arrayCountMap[prop] || (prop + "Num")
          } > -1).`
        });
      }
    }
  }
});
