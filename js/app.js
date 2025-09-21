/* =========================================================
   French Vocab Flashcards — app.js  (full replacement)
   ========================================================= */

/* ---------- configuration ---------- */
const SHEET_ENDPOINT =
const SHEET_ENDPOINT =
  "https://french-vocab-proxy.neil-186.workers.dev/?sheet=Form%20responses";

const DEFAULT_SRC = SHEET_ENDPOINT; // (no AllOrigins needed anymore)

/* ---------- dom helpers & app state ---------- */
const d = (id) => document.getElementById(id);

const state = {
  src: DEFAULT_SRC,
  rows: [],
  queue: [],
  idx: 0,
  today: new Date().toISOString().slice(0, 10),
  progress: {},
  direction: "fr-en", // 'fr-en' or 'en-fr'
  revealed: false,    // controls French sentence reveal on the French side
};

/* ---------- last-updated helpers (for refresh dock) ---------- */
const lastKey = () => "flashcards:lastUpdated::" + state.src;

function setLastUpdatedNow(){
  try{
    const ts = new Date().toISOString();
    localStorage.setItem(lastKey(), ts);
  }catch(e){}
  updateLastUpdated();
}

function updateLastUpdated(){
  const el = d("lastUpdated");
  if (!el) return;
  const ts = localStorage.getItem(lastKey());
  if (!ts) { el.textContent = ""; return; }
  const dt = new Date(ts);
  // short, locale-friendly stamp (e.g., "Updated 21 Sep, 14:32")
  const fmt = new Intl.DateTimeFormat(undefined,{
    day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"
  }).format(dt);
  el.textContent = `Updated ${fmt}`;
}

/* =========================================================
   CSV parsing & mapping
   ========================================================= */
function parseCSV(text) {
  const out = [], row = [];
  let i = 0, field = "", inQ = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { out.push(row.splice(0)); };

  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++;
      } else { field += c; i++; }
    } else {
      if (c === '"') { inQ = true; i++; }
      else if (c === ",") { pushField(); i++; }
      else if (c === "\n" || c === "\r") {
        pushField();
        if (row.length) pushRow();
        i++;
        if (c === "\r" && text[i] === "\n") i++;
      } else { field += c; i++; }
    }
  }
  if (field !== "" || row.length) { pushField(); pushRow(); }
  return out;
}

function mapHeaders(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => (h || "").trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  // Expected columns (case-insensitive):
  // id | deck | lesson | article | french | english | sentence | labels | tags | pron (optional)
  return rows.slice(1).map((r, ix) => ({
    id: (idx("id") >= 0 ? (r[idx("id")] || "") : "") || String(ix + 1),
    deck: (r[idx("deck")] || "").trim(),
    lesson: (r[idx("lesson")] || "").trim(),
    article: (r[idx("article")] || "").trim(),
    french: (r[idx("french")] || "").trim(),
    english: (r[idx("english")] || "").trim(),
    sentence: (r[idx("sentence")] || "").trim(),
    labels: (r[idx("labels")] || "").trim(),
    tags: (r[idx("tags")] || "").trim(),
    pron: (idx("pron") >= 0 ? (r[idx("pron")] || "") : "").trim(),
  })).filter(x => x.french || x.english);
}

/* =========================================================
   Local storage for progress (SM-5 style light scheduler)
   ========================================================= */
const key = () => "flashcards::" + state.src;
const saveProgress = () => localStorage.setItem(key(), JSON.stringify(state.progress));
const loadProgress = () => state.progress = JSON.parse(localStorage.getItem(key()) || "{}");

const SCHED = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 7 }; // days until next due by "box"
const nextDate = (from, days) => {
  const dt = new Date(from);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
};
const ensure = (id) => {
  if (!state.progress[id]) state.progress[id] = { box: 1, due: state.today };
};

function grade(g) {
  const c = state.queue[state.idx]; if (!c) return;
  ensure(c.id);
  const p = state.progress[c.id];
  if (g === "again") p.box = 1;
  if (g === "good")  p.box = Math.min(5, p.box + 1);
  if (g === "easy")  p.box = Math.min(5, p.box + 2);
  p.due = nextDate(state.today, SCHED[p.box]);
  saveProgress();
  next(1);
}

/* =========================================================
   Filtering, shuffle, stats
   ========================================================= */
function filter() {
  const deck   = (d("deckFilter")?.value || "").toLowerCase();
  const lesson = (d("lessonFilter")?.value || "").toLowerCase();
  const label  = (d("labelFilter")?.value || "").toLowerCase();   // label filter
  const q      = (d("search")?.value || "").toLowerCase();

  let rows = state.rows.filter(r => {
    const okDeck   = !deck   || r.deck.toLowerCase()   === deck;
    const okLesson = !lesson || r.lesson.toLowerCase() === lesson;

    const rLabels = (r.labels || "")
      .toLowerCase()
      .split(/[;,|]/)
      .map(s => s.trim())
      .filter(Boolean);
    const okLabel = !label || rLabels.includes(label);

    const hay = (r.french + " " + r.english + " " + r.sentence + " " + r.tags + " " + r.labels).toLowerCase();
    const okQ = !q || hay.includes(q);

    return okDeck && okLesson && okLabel && okQ;
  });

  loadProgress();
  if ((d("studyMode")?.value || "due") === "due") {
    rows = rows.filter(r => { ensure(r.id); return state.progress[r.id].due <= state.today; });
  }

  if ((d("shuffle")?.value || "yes") === "yes") {
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
  }

  state.queue = rows;
  state.idx = 0;
  state.revealed = false;
  stats();
  render();
}

function stats() {
  const mode = (d("studyMode")?.value || "due") === "due" ? "due today" : "in view";
  d("stats").textContent = `${state.queue.length} cards · ${mode}`;
}

/* =========================================================
   Forvo link helpers (article + noun) — top-right on French side
   ========================================================= */
function forvoSlug(display) {
  if (!display) return "";
  let t = display.trim();
  // strip (m), (f), (m pl), (f pl)
  t = t.replace(/\((?:m|f)(?:\s*pl)?\)/gi, "").trim();
  // normalise apostrophes & spaces
  t = t.replace(/’/g, "'").replace(/\s+/g, " ");
  // Forvo prefers underscores
  t = t.replace(/'/g, "_").replace(/\s/g, "_");
  return t.toLowerCase();
}

function buildForvoUrlFromCard(card) {
  const display = ((card.article ? card.article + " " : "") + (card.french || "")).trim();
  if (!display) return null;
  const slug = forvoSlug(display);
  return slug ? `https://forvo.com/word/${slug}/#fr` : null;
}

function updateForvoLinkVisibility() {
  const link = d("forvoLink");
  const cardEl = d("card");
  if (!link || !cardEl) return;

  const c = state.queue[state.idx];
  if (!c) { link.style.display = "none"; return; }

  const isFlipped = cardEl.classList.contains("flipped");
  // French visible when:
  // - FR->EN and not flipped
  // - EN->FR and flipped
  const frenchVisible =
    (state.direction === "fr-en" && !isFlipped) ||
    (state.direction === "en-fr" &&  isFlipped);

  if (frenchVisible) {
    const url = buildForvoUrlFromCard(c);
    if (url) {
      link.href = url;
      link.style.display = "inline-flex";
      return;
    }
  }
  link.style.display = "none";
}

/* =========================================================
   Populate filters (deck, lesson, label)
   ========================================================= */
function getAllLabels(rows){
  const set = new Set();
  rows.forEach(r=>{
    (r.labels || "")
      .split(/[;,|]/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(l => set.add(l));
  });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function populate() {
  const decks = [...new Set(state.rows.map((r) => r.deck).filter(Boolean))].sort();
  const lessons = [...new Set(state.rows.map((r) => r.lesson).filter(Boolean))].sort((a, b) => {
    const na = +a, nb = +b;
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
  const labels = getAllLabels(state.rows);

  if (d("deckFilter")) {
    d("deckFilter").innerHTML =
      '<option value="">All decks</option>' +
      decks.map((x) => `<option>${x}</option>`).join("");
  }

  if (d("lessonFilter")) {
    d("lessonFilter").innerHTML =
      '<option value="">All</option>' +
      lessons.map((x) => `<option>${x}</option>`).join("");
  }

  if (d("labelFilter")) {
    d("labelFilter").innerHTML =
      '<option value="">All labels</option>' +
      labels.map((x) => `<option>${x}</option>`).join("");
  }
}

/* =========================================================
   Render card
   ========================================================= */
function render() {
  const card = d("card");
  const actions = d("actions");
  const empty = d("empty");

  const c = state.queue[state.idx];
  if (!c) {
    card.style.display = "none";
    actions.style.display = "none";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  actions.style.display = "flex";
  card.style.display = "block";

  // meta label (e.g., "cognate")
  d("meta").textContent = c.labels || "";

  // Build French display term once
  const frDisplay = ((c.article ? c.article + " " : "") + (c.french || "")).trim();

  // Which side shows first?
  const frenchFront = state.direction === "fr-en";

  // Fill content
  if (frenchFront) {
    // FRONT = French
    d("article").textContent = c.article || "";
    d("term").textContent = c.french || "";
    d("pron").textContent = c.pron || "";
    d("answer").textContent = c.english || "";

    // French sentence hidden on FRONT until user clicks to reveal
    d("sentenceFront").textContent = state.revealed ? (c.sentence || "") : "";
    d("sentenceBack").textContent = ""; // empty on back in FR->EN
  } else {
    // FRONT = English
    d("article").textContent = "";
    d("term").textContent = c.english || "";
    d("pron").textContent = ""; // no pron on EN side
    d("answer").textContent = frDisplay;
    // In EN->FR, we keep sentence on BACK (French)
    d("sentenceFront").textContent = "";
    d("sentenceBack").textContent = c.sentence || "";
  }

  // Notes & tags
  d("notes").textContent = c.notes || "";
  d("tags").innerHTML = (c.tags || "")
    .split(/[;, ]+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => `<span class="tag">${t}</span>`)
    .join(" ");

  // Update Forvo icon/link presence
  updateForvoLinkVisibility();
}

const next = (step) => {
  if (!state.queue.length) return;
  state.idx = (state.idx + (step || 1) + state.queue.length) % state.queue.length;
  state.revealed = false; // new card → sentence hidden again if French is front
  d("card").classList.remove("flipped");
  render();
};

/* =========================================================
   Load CSV (NO custom headers → no CORS preflight)
   ========================================================= */
async function loadCsv(url) {
  try {
    const bust = (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url + bust);   // <-- no headers here
    if (!res.ok) throw new Error("HTTP " + res.status);
    const txt = await res.text();
    state.rows = mapHeaders(parseCSV(txt));
    populate();
    filter();
    setLastUpdatedNow(); // <-- stamp the time after a successful load
  } catch (e) {
    alert("Load failed: " + (e && e.message ? e.message : "Unknown error"));
  }
}

/* =========================================================
   Events
   ========================================================= */
// Reset progress
d("resetBtn")?.addEventListener("click", () => {
  if (confirm("Reset progress?")) {
    localStorage.removeItem(key());
    state.progress = {};
    filter();
  }
});

// Filters
["deckFilter", "lessonFilter", "labelFilter", "studyMode", "shuffle"].forEach((id) =>
  d(id)?.addEventListener("change", filter)
);
d("search")?.addEventListener("input", filter);

// Card click: if French is visible on the current face, toggle sentence reveal
d("card")?.addEventListener("click", (ev) => {
  const inForvo = ev.target.closest?.("#forvoLink");
  if (inForvo) return;

  const card = d("card");
  const isFlipped = card.classList.contains("flipped");
  const frenchVisible =
    (state.direction === "fr-en" && !isFlipped) ||
    (state.direction === "en-fr" &&  isFlipped);

  if (frenchVisible) {
    state.revealed = !state.revealed;
    render();
  }
});

// Flip
d("flipBtn")?.addEventListener("click", () => {
  const card = d("card");
  card.classList.toggle("flipped");
  const isFlipped = card.classList.contains("flipped");
  if (state.direction === "fr-en" && isFlipped) state.revealed = false;
  if (state.direction === "en-fr" && !isFlipped) state.revealed = false;
  updateForvoLinkVisibility();
});

// Grade buttons
d("againBtn")?.addEventListener("click", () => grade("again"));
d("goodBtn")?.addEventListener("click", () => grade("good"));
d("easyBtn")?.addEventListener("click", () => grade("easy"));

// Prev / Next buttons
d('prevBtn')?.addEventListener('click', () => next(-1));
d('nextBtn')?.addEventListener('click', () => next(1));

// Refresh button (bottom-left dock)
d("refreshBtn")?.addEventListener("click", () => loadCsv(state.src));

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  if (e.target && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === " ") { e.preventDefault(); d("card").classList.toggle("flipped"); updateForvoLinkVisibility(); }
  if (e.key === "ArrowRight") next(1);
  if (e.key === "ArrowLeft") next(-1);
  if (e.key === "1" || e.key.toLowerCase() === "a") grade("again");
  if (e.key === "2" || e.key.toLowerCase() === "g") grade("good");
  if (e.key === "3" || e.key.toLowerCase() === "e") grade("easy");
});

// Direction segmented control
d("dirSeg")?.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  [...document.querySelectorAll("#dirSeg button")].forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  state.direction = b.dataset.dir;
  state.revealed = false;
  d("card").classList.remove("flipped");
  render();
  updateForvoLinkVisibility();
});

// Hamburger menu toggle (mobile)
d("hamburger")?.addEventListener("click", () => {
  document.body.classList.toggle("menu-open");
});
document.querySelector(".scrim")?.addEventListener("click", () => {
  document.body.classList.remove("menu-open");
});

/* =========================================================
   Startup
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  updateLastUpdated();   // show previous timestamp (if any) straight away
  loadCsv(state.src);    // then fetch fresh data
});
