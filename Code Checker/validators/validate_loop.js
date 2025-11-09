// validators/validate_loop.js
window.validators.push(function validate_loop(lines,raw,issues){
  const stack=[];
  for(let i=0;i<lines.length;i++){
    const fm=lines[i].match(/for\s*\(([^)]*)\)/);
    if(fm){
      const v=(fm[1].match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=/)||[])[1];
      if(v && stack.includes(v))
        issues.push({type:'Nested loop var reuse',line:i+1,snippet:lines[i]});
      if(v) stack.push(v);
    }
    if(/\}/.test(lines[i]) && stack.length) stack.pop();
  }
});
