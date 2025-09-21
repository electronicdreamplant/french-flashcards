# French Vocab Flashcards

A lightweight, mobile-friendly flashcard app for practising French vocabulary. It pulls your cards from a Google Sheet (fed by a Google Form), schedules reviews with a simple spaced-repetition loop, and runs as a static site (e.g. GitHub Pages). No server required.

![french flashcards app screengrab](app_image.png)


## Objectives
* Study vocab “due today” using a light spaced-repetition cycle.
* Switch direction: French → English or English → French.
* Add new vocab easily via a Google Form.
* Keep all progress stored locally so multiple learners don’t interfere.
* Run anywhere with nothing more than a browser.


## How to Use the App

### Controls
* **Direction** – Choose which side of the card appears first (FR→EN or EN→FR).	•	Study – Show only cards “Due today” or all matching filters.
* **Deck** – Filter by deck/category (e.g., Food, Family, Classroom).
* **Lesson** – Narrow by lesson number or name.
* **Label** – Filter by special labels (e.g., cognate).
* **Search** – Free text search across French, English, sentences, labels, and tags.
* **Shuffle** – Shuffle the order of the current set.
* **Reset progress** – Clear your learning history for this data source.

### Cards
* **Front/Back** – Shows French or English depending on the direction.
* **Sentence** – Hidden on the French side until tapped; always shown on the French back.
* **Labels** – Small text marker (e.g., cognate).
* **Tags** – Optional keyword markers.
* **Pronouncation link** – Appears on the French side, opens Forvo pronunciation page in a new tab.

### Actions
* **Again / Good / Easy** – Grades your recall and schedules the next review.
* **Flip** – Show the reverse side of the card.
* **Prev / Next** – Move through the filtered set.

### Refresh
* Bottom-left of the screen:
* A refresh button to reload the sheet data.
* A “last updated” timestamp so you know when the data was last fetched.

### Shortcuts (desktop)
* Space – Flip
* Left / Right arrows – Prev / Next
* 1 or A – Again
* 2 or G – Good
* 3 or E – Easy


## Data Model (Google Sheet)

The app expects a header row with these columns (case insensitive):
* deck – e.g., Food, Family, Classroom
* lesson – number or text
* article – le, la, l’, les
* french – the word itself
* english – translation
* sentence – optional short sentence
* labels – optional label (supports multiple with commas/semicolons/pipes)
* tags – optional keywords
* id – optional unique ID (if not present, app generates)

Other columns such as Timestamp (from the Form) are ignored.


## Scheduling

Each card is assigned a “box” (1–5) with days until next review:
* Box 1 → 0 days
* Box 2 → 1 day
* Box 3 → 2 days
* Box 4 → 4 days
* Box 5 → 7 days

Actions adjust the box:
* Again = reset to 1
* Good = +1 box (max 5)
* Easy = +2 boxes (max 5)

Progress is stored in localStorage in the browser, keyed by the data source URL.


## Architecture

### Data flow
1. **Add vocab** via the Google Form.
2. Responses land in the Google Sheet (the **Form responses** tab).
3. A tiny **Google Apps Script** publishes the sheet as a CSV/JSON **web app endpoint**.
4. The app fetches that endpoint **via AllOrigins** (a public CORS passthrough).
5. Cards are rendered in the browser; filtering and spaced-repetition scheduling run **locally** and progress is stored in **localStorage**.

> Why AllOrigins? Apps Script web apps don’t reliably answer CORS preflights. Routing through AllOrigins returns permissive CORS headers so a simple `fetch()` works from GitHub Pages.  
> Alternatives: use Google’s **gviz** CSV endpoint (if the sheet can be “Anyone with link – Viewer”), or your own tiny CORS proxy (e.g., Cloudflare Worker).

### Files
#### index.html 
Includes the sidebar controls (Direction, Study, Deck, Lesson, Label, Search, Shuffle), the card area (front/back, sentence, tags, label), action buttons (Again/Good/Easy/Flip, Prev/Next), and the bottom-left **Refresh** control with “Updated …” timestamp.

#### css/style.css  
Layout, card styling, mobile hamburger menu, large tap targets, and the fixed refresh dock.

#### js/app.js
* **Data loading:** builds `DEFAULT_SRC` from your Apps Script URL and wraps it with AllOrigins; adds a `?t=Date.now()` cache-buster on each load.  
* **CSV parsing & mapping:** reads the published CSV and maps header names (case-insensitive) to fields: `deck, lesson, article, french, english, sentence, labels, tags, id` (and `pron` if you add it).  
* **Filters & search:** Deck/Lesson/Label filters; free-text search across French/English/Sentence/Labels/Tags.  
* **Scheduler:** light SM-5 style (boxes 1–5 with 0/1/2/4/7-day intervals). Progress is saved in `localStorage` **per data source URL**.  
* **Rendering:** FR→EN shows French on the front (sentence hidden until tapped), EN→FR shows English on the front and the French sentence on the back.  
* **Forvo link:** when French is visible, a top-right link opens the Forvo page for `article + word`.  
* **Refresh dock:** reloads data on demand and updates the “Updated …” timestamp.

#### js/utils.js (optional but recommended)  
A small helper library to keep `app.js` lean. Typical utilities:
* `parseCSV(text)` — robust CSV parser (quotes, commas, CRLF).  
* `splitLabels(str)` — split on comma/semicolon/pipe and trim.  
* `slugifyForvo(display)` — build a Forvo-friendly slug from `article + french` (strips `(m)`, `(f)`, `(… pl)`, normalises spaces/apostrophes).  
* `cacheBust(url)` — append `?t=Date.now()` or `&t=…`.  
* `formatUpdated(ts)` — human-friendly “Updated 21 Sep, 14:32”.

If you include it, load **before** `app.js`:
```html
  <script src="js/utils.js"></script>
  <script src="js/app.js"></script>
```

## Setup & Configuration
* Google Form – inputs vocab directly to the sheet.
* Google Sheet – holds the Form responses tab.
* Apps Script – publishes a web app endpoint for CSV export.
* GitHub Pages (or any static host) – serves the HTML/CSS/JS.

In app.js, configure:
```javascript
const SHEET_ENDPOINT = "https://script.google.com/macros/s/…/exec?sheet=Form%20responses";
const DEFAULT_SRC = "https://api.allorigins.win/raw?url=" + encodeURIComponent(SHEET_ENDPOINT);
```
Update if your script URL or sheet name changes.

## Mobile Use
* Hamburger menu opens filters.
* Large, touch-friendly buttons.
* Refresh button and “last updated” timestamp always visible.
* Add to Home Screen on iOS/Android for an app-like experience.
