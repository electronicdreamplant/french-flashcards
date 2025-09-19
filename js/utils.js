/* utils.js — classic (non-module). No exports/imports. */
(function (global) {
  "use strict";

  // CSV parser with quoted-field support ("", commas, CRLF)
  function parseCSV(text) {
    const out = [];
    const row = [];
    const pushRow = () => out.push(row.splice(0));
    let i = 0, field = "", inQ = false;

    const pushField = () => { row.push(field); field = ""; };

    while (i < text.length) {
      const c = text[i];

      if (inQ) {
        if (c === '"') {
          // Double quote inside quoted field => literal quote
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          // Closing quote
          inQ = false; i++; continue;
        } else {
          field += c; i++; continue;
        }
      } else {
        if (c === '"') { inQ = true; i++; continue; }
        if (c === ",") { pushField(); i++; continue; }
        if (c === "\n" || c === "\r") {
          pushField();
          if (row.length) pushRow();
          i++;
          if (c === "\r" && text[i] === "\n") i++; // CRLF
          continue;
        }
        field += c; i++;
      }
    }

    if (field !== "" || row.length) { pushField(); pushRow(); }
    return out;
  }

  // Map a CSV table to card objects using header names (case-insensitive)
  function mapHeaders(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => (h || "").trim().toLowerCase());
    const idx = (name) => header.indexOf(name);

    return rows.slice(1).map((r, ix) => ({
      id:       r[idx("id")]        || String(ix + 1),
      deck:     (r[idx("deck")]     || "").trim(),
      lesson:   (r[idx("lesson")]   || "").trim(),
      article:  (r[idx("article")]  || "").trim(),
      french:   (r[idx("french")]   || "").trim(),
      english:  (r[idx("english")]  || "").trim(),
      sentence: (r[idx("sentence")] || "").trim(),
      pron:     (r[idx("pron")]     || "").trim(),
      tags:     (r[idx("tags")]     || "").trim(),
      notes:    (r[idx("notes")]    || "").trim(),
      labels:   (r[idx("labels")]   || "").trim(),
    })).filter(x => x.french || x.english);
  }

  // Expose globally (without clobbering if already present)
  if (!global.parseCSV)   global.parseCSV   = parseCSV;
  if (!global.mapHeaders) global.mapHeaders = mapHeaders;

})(window);
