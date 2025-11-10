// validators/validate_divzero.js
window.validators.push(function validate_divzero(lines, raw, issues) {
  const zeros = new Map(); // variableName -> last assigned value (true if 0, false otherwise)
  let inBlockComment = false; // track multi-line /* ... */ comments

  for (let i = 0; i < lines.length; i++) {
      let ln = lines[i];

      // Skip multi-line comments
      if (inBlockComment) {
          if (ln.includes("*/")) {
              inBlockComment = false;
              ln = ln.split("*/")[1] || ""; // continue after comment
          } else {
              continue; // still inside block comment
          }
      }

      // Handle start of multi-line comment
      if (ln.includes("/*")) {
          inBlockComment = true;
          ln = ln.split("/*")[0]; // keep only code before comment
      }

      // Skip full-line single-line comments
      const trimmed = ln.trim();
      if (trimmed.startsWith("//") || trimmed === "") continue;

      // Track explicit assignment to 0 or non-zero
      const assignMatch = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/);
      if (assignMatch) {
          const varName = assignMatch[1];
          const value = assignMatch[2].trim();
          zeros.set(varName, value === "0");
      }

      // Check literal division by zero
      if (/\/\s*0(?![0-9])/.test(ln)) {
          issues.push({
              type: 'Division by zero (literal)',
              line: i + 1,
              snippet: ln.trim()
          });
      }

      // Check division by variable
      const divVarMatch = ln.match(/\/\s*([A-Za-z_][A-Za-z0-9_]*)/);
      if (divVarMatch) {
          const varName = divVarMatch[1];
          if (zeros.get(varName)) {
              issues.push({
                  type: 'Division by zero (var)',
                  line: i + 1,
                  snippet: ln.trim()
              });
          }
      }
  }
});
