// ---- CONFIG ----
const DEFAULT_SRC =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTm0yTZkHyweym1ITZbZGg2AJJByj35kMoCXggEwDuRwFwtLNqyhuEaZsNBS_fzbDseq8f8lrnYI3MU/pub?gid=0&single=true&output=csv';

// ---- STATE ----
const d = id => document.getElementById(id);
const state = {
  src: DEFAULT_SRC,
  rows: [],
  queue: [],
  idx: 0,
  today: new Date().toISOString().slice(0,10),
  progress: {},
  direction: 'fr-en', // or 'en-fr'
};

// ---- STORAGE ----
const key = () => 'flashcards::' + state.src;
const saveProgress = () => localStorage.setItem(key(), JSON.stringify(state.progress));
const loadProgress = () => state.progress = JSON.parse(localStorage.getItem(key()) || '{}');

// ---- SCHEDULING (Leitner) ----
const SCHED = {1:0, 2:1, 3:2, 4:4, 5:7}; // keep as-is per your preference
const nextDate = (from,days) => { const dt = new Date(from); dt.setDate(dt.getDate()+days); return dt.toISOString().slice(0,10); };
const ensure = id => { if(!state.progress[id]) state.progress[id] = {box:1, due:state.today}; };

function grade(which){
  const c = state.queue[state.idx]; if(!c) return;
  ensure(c.id);
  const p = state.progress[c.id];
  if(which === 'again') p.box = 1;
  if(which === 'good')  p.box = Math.min(5, p.box + 1);
  if(which === 'easy')  p.box = Math.min(5, p.box + 2);
  p.due = nextDate(state.today, SCHED[p.box]);
  saveProgress();
  next(1);
}

// ---- FILTERING ----
function filter(){
  const deck   = d('deckFilter').value.toLowerCase();
  const lesson = d('lessonFilter').value.toLowerCase();
  const q      = d('search').value.toLowerCase();

  let rows = state.rows.filter(r =>
    (!deck   || r.deck.toLowerCase()   === deck)   &&
    (!lesson || r.lesson.toLowerCase() === lesson) &&
    (!q || (r.french + ' ' + r.english + ' ' + r.sentence + ' ' + r.tags).toLowerCase().includes(q))
  );

  loadProgress();
  if (d('studyMode').value === 'due') {
    rows = rows.filter(r => { ensure(r.id); return state.progress[r.id].due <= state.today; });
  }

  if (d('shuffle').value === 'yes') {
    for(let i=rows.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [rows[i],rows[j]]=[rows[j],rows[i]]; }
  }

  state.queue = rows;
  state.idx = 0;
  stats();
  render();
}

function stats(){
  d('stats').textContent = `${state.queue.length} cards · ${d('studyMode').value==='due' ? 'due today' : 'in view'}`;
}

// ---- RENDER (fix: sentence only on French side) ----
function render(){
  const card    = d('card'), actions = d('actions'), empty = d('empty');
  const c = state.queue[state.idx];
  if(!c){ card.style.display='none'; actions.style.display='none'; empty.style.display='block'; return; }
  empty.style.display='none'; actions.style.display='flex'; card.style.display='block';

  d('meta').textContent = c.labels || '';

  const fr = (c.article ? c.article + ' ' : '') + (c.french || '');

  if (state.direction === 'fr-en') {
    // FRONT = French, BACK = English
    d('article').textContent = c.article || '';
    d('term').textContent    = c.french  || '';
    d('pron').textContent    = c.pron    || '';
    d('answer').textContent  = c.english || '';
    d('sentenceFront').textContent = c.sentence || '';
    d('sentenceBack').textContent  = '';
  } else {
    // FRONT = English, BACK = French
    d('article').textContent = '';
    d('term').textContent    = c.english || '';
    d('pron').textContent    = '';
    d('answer').textContent  = fr.trim();
    d('sentenceFront').textContent = '';
    d('sentenceBack').textContent  = c.sentence || '';
  }

  d('notes').textContent = c.notes || '';
  d('tags').innerHTML = (c.tags||'')
    .split(/[;, ]+/).filter(Boolean).slice(0,8)
    .map(t => `<span class="tag">${t}</span>`).join(' ');
}

const next = step => { if(!state.queue.length) return; state.idx = (state.idx + (step||1) + state.queue.length) % state.queue.length; render(); };

// ---- LOAD ----
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
  const decks   = [...new Set(state.rows.map(r=>r.deck).filter(Boolean))].sort();
  const lessons = [...new Set(state.rows.map(r=>r.lesson).filter(Boolean))].sort((a,b)=>isNaN(a)-isNaN(b)||a-b);
  d('deckFilter').innerHTML   = '<option value="">All decks</option>' + decks.map(x=>`<option>${x}</option>`).join('');
  d('lessonFilter').innerHTML = '<option value="">All</option>'      + lessons.map(x=>`<option>${x}</option>`).join('');
}

// ---- EVENTS ----
d('resetBtn').addEventListener('click', ()=>{
  if(confirm('Reset progress for this source?')){
    localStorage.removeItem('flashcards::'+state.src);
    state.progress = {};
    filter();
  }
});
['deckFilter','lessonFilter','studyMode','shuffle'].forEach(id => d(id).addEventListener('change', filter));
d('search').addEventListener('input', filter);
d('flipBtn').addEventListener('click', ()=> d('card').classList.toggle('flipped'));
d('againBtn').addEventListener('click', ()=> grade('again'));
d('goodBtn').addEventListener('click',  ()=> grade('good'));
d('easyBtn').addEventListener('click',  ()=> grade('easy'));
window.addEventListener('keydown', e=>{
  if(e.key===' ') { e.preventDefault(); d('card').classList.toggle('flipped'); }
  if(e.key==='ArrowRight') next(1);
  if(e.key==='ArrowLeft')  next(-1);
  if(e.key==='1'||e.key.toLowerCase()==='a') grade('again');
  if(e.key==='2'||e.key.toLowerCase()==='g') grade('good');
  if(e.key==='3'||e.key.toLowerCase()==='e') grade('easy');
});
document.getElementById('dirSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  [...document.querySelectorAll('#dirSeg button')].forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  state.direction = b.dataset.dir;
  render();
});

// ---- STARTUP ----
document.addEventListener('DOMContentLoaded', ()=> loadCsv(state.src));
