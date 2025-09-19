// CSV parser with quoted field support
export function parseCSV(text){
  const out=[], row=[], pushRow=()=>out.push(row.splice(0));
  let i=0, field='', inQ=false;
  const pushField=()=>{ row.push(field); field=''; };
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c === '"'){
        if(text[i+1] === '"'){ field+='"'; i+=2; continue; }
        inQ=false; i++;
      } else { field += c; i++; }
    } else {
      if(c === '"'){ inQ=true; i++; }
      else if(c === ','){ pushField(); i++; }
      else if(c === '\n' || c === '\r'){ pushField(); if(row.length) pushRow(); i++; if(c==='\r' && text[i]==='\n') i++; }
      else { field += c; i++; }
    }
  }
  if(field!=='' || row.length){ pushField(); pushRow(); }
  return out;
}

export function mapHeaders(rows){
  if(!rows.length) return [];
  const header = rows[0].map(h=>h.trim().toLowerCase());
  const idx = n => header.indexOf(n);
  return rows.slice(1).map((r,ix)=>({
    id:       r[idx('id')]       || String(ix+1),
    deck:     (r[idx('deck')]    || '').trim(),
    lesson:   (r[idx('lesson')]  || '').trim(),
    article:  (r[idx('article')] || '').trim(),
    french:   (r[idx('french')]  || '').trim(),
    english:  (r[idx('english')] || '').trim(),
    sentence: (r[idx('sentence')]|| '').trim(),
    pron:     (r[idx('pron')]    || '').trim(),
    tags:     (r[idx('tags')]    || '').trim(),
    notes:    (r[idx('notes')]   || '').trim(),
    labels:   (r[idx('labels')]  || '').trim(),
  })).filter(x => x.french || x.english);
}
