// ---------- configuration ----------
const DEFAULT_SRC = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTm0yTZkHyweym1ITZbZGg2AJJByj35kMoCXggEwDuRwFwtLNqyhuEaZsNBS_fzbDseq8f8lrnYI3MU/pub?gid=1046747301&single=true&output=csv";

// ---------- state ----------
const d = id => document.getElementById(id);
const state = {
  src: DEFAULT_SRC,
  rows: [],
  queue: [],
  idx: 0,
  today: new Date().toISOString().slice(0,10),
  progress: {},
  direction: "fr-en",   // or "en-fr"
  showSentence: false,  // click-to-reveal (French side only)
};

// ---------- CSV parsing ----------
function parseCSV(text){
  const out=[], row=[], pushRow=()=>{ out.push(row.splice(0)); };
  let i=0, field='', inQ=false; const pushField=()=>{ row.push(field); field=''; };
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i+=2; continue; } inQ=false; i++; }
      else { field+=c; i++; }
    } else {
      if(c==='"'){ inQ=true; i++; }
      else if(c===','){ pushField(); i++; }
      else if(c==='\n' || c==='\r'){ pushField(); if(row.length) pushRow(); i++; if(c==='\r' && text[i]==='\n') i++; }
      else { field+=c; i++; }
    }
  }
  if(field!==''||row.length){ pushField(); pushRow(); }
  return out;
}

function mapHeaders(rows){
  if(!rows.length) return [];
  const header = rows[0].map(h=> (h||'').trim().toLowerCase());
  const idx = n => header.indexOf(n);
  return rows.slice(1).map((r,ix)=>({
    id: makeKey(r, idx),
    deck:     (r[idx('deck')]     || '').trim(),
    lesson:   (r[idx('lesson')]   || '').trim(),
    article:  (r[idx('article')]  || '').trim(),
    french:   (r[idx('french')]   || '').trim(),
    english:  (r[idx('english')]  || '').trim(),
    sentence: (r[idx('sentence')] || '').trim(),
    pron:     (r[idx('pron')]     || '').trim(),
    tags:     (r[idx('tags')]     || '').trim(),
    notes:    (r[idx('notes')]    || '').trim(),
    labels:   (r[idx('labels')]   || '').trim(),
  })).filter(x => x.french || x.english);
}

function makeKey(row, idx) {
  const val = (name) => (row[idx(name)] || '').toString().trim().toLowerCase();
  return [val('deck'), val('lesson'), val('article'), val('french'), val('english')].join('¦');
}

// ---------- storage ----------
const key = ()=> 'flashcards::' + state.src;
const saveProgress = ()=> localStorage.setItem(key(), JSON.stringify(state.progress));
const loadProgress = ()=> state.progress = JSON.parse(localStorage.getItem(key()) || '{}');

// ---------- scheduling (Leitner) ----------
const SCHED = {1:0, 2:1, 3:2, 4:4, 5:7};
const nextDate = (from,days)=>{ const dt=new Date(from); dt.setDate(dt.getDate()+days); return dt.toISOString().slice(0,10); };
const ensure = id => { if(!state.progress[id]) state.progress[id] = {box:1, due:state.today}; };

function grade(which){
  const c = state.queue[state.idx]; if(!c) return;
  ensure(c.id);
  const p = state.progress[c.id];
  if(which==='again') p.box = 1;
  if(which==='good')  p.box = Math.min(5, p.box+1);
  if(which==='easy')  p.box = Math.min(5, p.box+2);
  p.due = nextDate(state.today, SCHED[p.box]);
  saveProgress();
  next(1);
}

// ---------- helpers ----------
function frenchVisible() {
  const flipped = d('card').classList.contains('flipped');
  return (state.direction === 'fr-en' && !flipped) ||
         (state.direction === 'en-fr' &&  flipped);
}
function resetToFront() {
  const cardEl = d('card');
  if (cardEl) cardEl.classList.remove('flipped');
  state.showSentence = false;
}

// ---------- filtering ----------
function filter(){
  const deck   = d('deckFilter').value.toLowerCase();
  const lesson = d('lessonFilter').value.toLowerCase();
  const label  = (d('labelFilter')?.value || '').toLowerCase();
  const q      = d('search').value.toLowerCase();

  let rows = state.rows.filter(r => {
    const labelsArr = (r.labels || '')
      .toLowerCase()
      .split(/[;,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    return (!deck   || r.deck.toLowerCase()   === deck) &&
           (!lesson || r.lesson.toLowerCase() === lesson) &&
           (!label  || labelsArr.includes(label)) &&
           (!q || (r.french + ' ' + r.english + ' ' + r.sentence + ' ' + r.tags).toLowerCase().includes(q));
  });

  loadProgress();
  if (d('studyMode').value === 'due') {
    rows = rows.filter(r => { ensure(r.id); return state.progress[r.id].due <= state.today; });
  }

  if (d('shuffle').value === 'yes') {
    for(let i=rows.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [rows[i],rows[j]]=[rows[j],rows[i]]; }
  }

  state.queue = rows;
  state.idx = 0;
  resetToFront();
  stats();
  render();
}

function stats(){
  d('stats').textContent = `${state.queue.length} cards · ${d('studyMode').value==='due' ? 'due today' : 'in view'}`;
}

// ---------- render ----------
function render(){
  // Keep 'showSentence' only if French is currently visible
  state.showSentence = state.showSentence && frenchVisible();

  const card    = d('card'), actions = d('actions'), empty = d('empty');
  const c = state.queue[state.idx];
  if(!c){ card.style.display='none'; actions.style.display='none'; empty.style.display='block'; return; }

  empty.style.display='none'; actions.style.display='flex'; card.style.display='block';

  d('meta').textContent = c.labels || '';
  const fr = ((c.article ? c.article + ' ' : '') + (c.french || '')).trim();

  if (state.direction === 'fr-en') {
    // FRONT = French, BACK = English
    d('article').textContent = c.article || '';
    d('term').textContent    = c.french  || '';
    d('pron').textContent    = c.pron    || '';
    d('answer').textContent  = c.english || '';

    d('sentenceFront').textContent = (state.showSentence && frenchVisible()) ? (c.sentence || '') : '';
    d('sentenceBack').textContent  = '';
  } else {
    // FRONT = English, BACK = French
    d('article').textContent = '';
    d('term').textContent    = c.english || '';
    d('pron').textContent    = '';
    d('answer').textContent  = fr;

    d('sentenceFront').textContent = '';
    d('sentenceBack').textContent  = (state.showSentence && frenchVisible()) ? (c.sentence || '') : '';
  }

  d('notes').textContent = c.notes || '';
  d('tags').innerHTML = (c.tags||'')
    .split(/[;, ]+/).filter(Boolean).slice(0,8)
    .map(t => `<span class="tag">${t}</span>`).join(' ');
}

// Next/Prev — always start new card on front
const next = step => {
  if (!state.queue.length) return;
  state.idx = (state.idx + (step || 1) + state.queue.length) % state.queue.length;
  resetToFront();
  render();
};

// ---------- load ----------
async function loadCsv(url){
  try{
    const res = await fetch(url, { headers: { 'Cache-Control':'no-cache' } });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const txt = await res.text();
    state.rows = mapHeaders(parseCSV(txt));
    populate();
    filter();
  }catch(e){
    alert('Load failed: ' + e.message);
  }
}

function populate(){
  // Decks
  const decks   = [...new Set(state.rows.map(r=>r.deck).filter(Boolean))].sort();
  d('deckFilter').innerHTML   = '<option value="">All decks</option>' + decks.map(x=>`<option>${x}</option>`).join('');

  // Lessons
  const lessons = [...new Set(state.rows.map(r=>r.lesson).filter(Boolean))].sort((a,b)=>isNaN(a)-isNaN(b)||a-b);
  d('lessonFilter').innerHTML = '<option value="">All</option>' + lessons.map(x=>`<option>${x}</option>`).join('');

  // Labels
  const labelTokens = new Set();
  state.rows.forEach(r=>{
    (r.labels || '').split(/[;,]+/).forEach(tok=>{
      const t = tok.trim();
      if (t) labelTokens.add(t);
    });
  });
  const labels = [...labelTokens].sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:'base'}));
  const labelSel = document.getElementById('labelFilter');
  if (labelSel) labelSel.innerHTML = '<option value="">All labels</option>' + labels.map(x=>`<option>${x}</option>`).join('');
}

// ---------- events ----------
d('resetBtn').addEventListener('click', ()=>{
  if(confirm('Reset progress for this source?')){
    localStorage.removeItem('flashcards::'+state.src);
    state.progress = {};
    resetToFront();
    filter();
  }
});
['deckFilter','lessonFilter','labelFilter','studyMode','shuffle'].forEach(id=> {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', filter);
});
d('search').addEventListener('input', filter);

// Flip
d('flipBtn').addEventListener('click', ()=>{
  d('card').classList.toggle('flipped');
  state.showSentence = false; // hide when flipping
  render();
});

// Prev / Next (touch-friendly)
document.getElementById('prevBtn').addEventListener('click', ()=> next(-1));
document.getElementById('nextBtn').addEventListener('click', ()=> next(1));

// Click-to-reveal sentence (French side only)
d('card').addEventListener('click', (e)=>{
  // Ignore clicks on the bottom actions bar
  if (e.target.closest('.actions')) return;
  if (frenchVisible()) {
    state.showSentence = !state.showSentence;
    render();
  }
});

// Keyboard shortcuts (desktop still supported)
window.addEventListener('keydown', e=>{
  if(e.key===' '){
    e.preventDefault();
    d('card').classList.toggle('flipped');
    state.showSentence = false;
    render();
  }
  if(e.key==='ArrowRight') next(1);
  if(e.key==='ArrowLeft')  next(-1);
  if(e.key==='1'||e.key.toLowerCase()==='a') grade('again');
  if(e.key==='2'||e.key.toLowerCase()==='g') grade('good');
  if(e.key==='3'||e.key.toLowerCase()==='e') grade('easy');
});

// Direction segmented control
document.getElementById('dirSeg').addEventListener('click', e=>{
  const b = e.target.closest('button');
  if (!b) return;
  [...document.querySelectorAll('#dirSeg button')].forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.direction = b.dataset.dir;
  resetToFront();
  render();
});

// ------- Mobile menu (hamburger) -------
const menuBtn = document.getElementById('menuBtn');
const scrim = document.getElementById('scrim');
function openMenu(){ document.body.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded','true'); scrim.hidden=false; }
function closeMenu(){ document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded','false'); scrim.hidden=true; }
menuBtn?.addEventListener('click', ()=> (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
scrim?.addEventListener('click', closeMenu);
window.addEventListener('keydown', e=> { if(e.key==='Escape') closeMenu(); });

// ---------- startup ----------
document.addEventListener('DOMContentLoaded', ()=> loadCsv(state.src));
