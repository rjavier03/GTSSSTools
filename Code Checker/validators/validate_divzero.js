// validators/validate_divzero.js
window.validators.push(function validate_divzero(lines,raw,issues){
  const zeros=new Set();
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    const m=ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*0\s*;/);
    if(m) zeros.add(m[1]);
    if(/\/\s*0(?![0-9])/.test(ln))
      issues.push({type:'Division by zero (literal)',line:i+1,snippet:ln.trim()});
    const m2=ln.match(/\/\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if(m2 && zeros.has(m2[1]))
      issues.push({type:'Division by zero (var)',line:i+1,snippet:ln.trim()});
  }
});
