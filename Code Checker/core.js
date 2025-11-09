window.validators = [];

function escapeHtml(s){
  if(!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Add color for braces, parentheses, brackets
function highlightBraces(line) {
    line = escapeHtml(line);
    const patterns = [
        { regex: /(\{)/g, cls: 'brace' },
        { regex: /(\})/g, cls: 'brace' },
        { regex: /(\()/g, cls: 'paren' },
        { regex: /(\))/g, cls: 'paren' },
        { regex: /(\[)/g, cls: 'bracket' },
        { regex: /(\])/g, cls: 'bracket' }
    ];
    patterns.forEach(p => line = line.replace(p.regex, `<span class="${p.cls}">$1</span>`));
    return line;
}

function makePreview(lines){
  const preview = document.getElementById('preview');
  preview.innerHTML = '';
  for(let i=0;i<lines.length;i++){
    const ln = document.createElement('div');
    ln.className = 'line';
    ln.id = 'L'+(i+1);

    const num = document.createElement('span');
    num.className = 'ln';
    num.textContent = (i+1).toString().padStart(3,' ') + ' ';

    const txt = document.createElement('span');
    txt.innerHTML = highlightBraces(lines[i]);

    ln.appendChild(num);
    ln.appendChild(txt);
    preview.appendChild(ln);
  }
}

function jumpToLine(line){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
  const el = document.getElementById('L'+line);
  if(el){ el.classList.add('highlight'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
}

function analyze(raw){
  const lines = raw.split('\n');
  const issues = [];
  const ctx = {};
  for(let i=0;i<window.validators.length;i++){
    try{ window.validators[i](lines, raw, issues, ctx); } catch(e){ console.error(e); }
  }
  return {issues, lines};
}

function renderResults(res){
  makePreview(res.lines);
  const issuesEl = document.getElementById('issues');
  issuesEl.innerHTML = '';
  if(res.issues.length===0){
    const ok = document.createElement('div');
    ok.className='issue';
    ok.innerHTML='<h4>No issues found</h4>';
    issuesEl.appendChild(ok);
    return;
  }
  res.issues.forEach(it=>{
    const card = document.createElement('div');
    card.className='issue';
    const h = document.createElement('h4'); h.textContent = it.type;
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent='Line '+it.line;
    const pre = document.createElement('pre'); pre.textContent=it.snippet||'';
    card.appendChild(h); card.appendChild(meta); card.appendChild(pre);
    if(it.detail){
      const det = document.createElement('div'); det.style.color='#9aa9bf'; det.style.marginTop='4px';
      det.textContent=it.detail;
      card.appendChild(det);
    }
    const btn = document.createElement('button'); btn.textContent='Go to line';
    btn.addEventListener('click', ()=> jumpToLine(it.line));
    card.appendChild(btn);
    issuesEl.appendChild(card);
  });
  if(res.issues[0]) jumpToLine(res.issues[0].line);
}

document.getElementById('run').addEventListener('click', ()=>{
  const raw = document.getElementById('code').value;
  const res = analyze(raw);
  renderResults(res);
});

document.getElementById('clear').addEventListener('click', ()=>{
  document.getElementById('code').value='';
  document.getElementById('preview').innerHTML='';
  document.getElementById('issues').innerHTML='';
});
