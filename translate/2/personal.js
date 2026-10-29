/* Personal expressions are separate from the replaceable base dictionary. */
'use strict';
window.personal = (() => {
  const $ = id => document.getElementById(id);
  const norm = value => value.trim().normalize('NFC').toLowerCase().normalize('NFC');
  const MAX = 10000, FORMAT = 'unicode-translate-personal', VERSION = 1;
  let db, languages, rows = [], editId = null, attribution = [], importing = null;
  let saving = false, initialized = false, persistenceRequested = false;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('unicode-translate-personal:' + document.querySelector('meta[name="storage-key"]').content) : null;
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function status(message, error = false) {
    $('personal-status').textContent = message;
    $('personal-status').classList.toggle('form-error', error);
  }
  function text(value, limit, label) {
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u.test(value)) throw new Error('Invalid ' + label + '.');
    return value.trim().normalize('NFC');
  }
  function validate(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.terms || typeof entry.terms !== 'object' || Array.isArray(entry.terms)) throw new Error('Each expression needs language entries.');
    const terms = {};
    for (const [lang, value] of Object.entries(entry.terms)) {
      if (!Object.hasOwn(languages, lang)) throw new Error('Unsupported language: ' + lang);
      const phrase = text(value, 4096, 'expression');
      if (phrase) terms[lang] = phrase;
    }
    if (Object.keys(terms).length < 2) throw new Error('Enter expressions in at least two languages.');
    const note = text(entry.note ?? '', 4096, 'note');
    const sources = entry.attribution ?? [];
    if (!Array.isArray(sources) || sources.length > 100) throw new Error('Invalid source attribution.');
    const notices = sources.map(source => {
      if (!source || typeof source !== 'object') throw new Error('Invalid source attribution.');
      const id = text(source.id, 200, 'source ID'), license = text(source.license, 500, 'source license');
      const url = text(source.url, 2048, 'source URL');
      if (!/^https?:$/.test(new URL(url).protocol) || !id || !license) throw new Error('Invalid source URL or license.');
      return {id, license, url};
    });
    const timestamps = {};
    for (const key of ['createdAt','updatedAt']) if (entry[key] !== undefined) {
      if (!Number.isSafeInteger(entry[key]) || entry[key] < 0) throw new Error('Invalid expression timestamp.');
      timestamps[key] = entry[key];
    }
    return {terms, note, attribution: notices, ...timestamps};
  }
  function fingerprint(entry) {
    return JSON.stringify([Object.entries(entry.terms).sort(([a],[b]) => a.localeCompare(b)).map(([lang,value]) => [lang,norm(value)]), entry.note, entry.attribution.map(s=>[s.id,s.license,s.url]).sort()]);
  }
  function overlaps(a, b) {
    return Object.keys(a.terms).some(lang => b.terms[lang] && norm(a.terms[lang]) === norm(b.terms[lang]));
  }
  function checkBackupSize(entries) {
    // Leave room for the export envelope so every complete backup can be reimported.
    if (new Blob([JSON.stringify(entries)]).size > 9 * 1024 * 1024) throw new Error('Personal dictionary size limit reached (9 MB). Export a backup and split your expressions across samples.');
  }
  function abort(tx) {try {tx.abort();} catch { /* It may already be aborted by the browser. */ }}
  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', mode), store = tx.objectStore('entries');
      let result;
      try { result = action(store); } catch (error) {abort(tx); reject(error); return;}
      tx.oncomplete = () => resolve(result?.result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Your expressions could not be saved. Export a backup and check available device storage.'));
    });
  }
  async function reload() {
    rows = await transaction('readonly', store => store.getAll());
    render();
    window.dispatchEvent(new Event('personalchange'));
  }
  async function changed(message) {
    await reload(); channel?.postMessage('changed'); status(message);
    if (!persistenceRequested && navigator.storage?.persist) {persistenceRequested=true;navigator.storage.persist().catch(()=>{});}
  }
  function open(entry) {
    if (!initialized) return;
    editId = entry?.id || null;
    attribution = entry?.attribution || [];
    $('expression-title').textContent = editId ? 'Edit expression' : 'Add expression';
    for (const lang of Object.keys(languages)) $('term-' + lang).value = entry?.terms?.[lang] || '';
    $('expression-note').value = entry?.note || '';
    $('expression-attribution').textContent = attribution.length ? 'Source attribution is retained: ' + attribution.map(s=>s.id+' ('+s.license+')').join(' · ') : 'Your own expression. No translation is inferred for languages you leave empty.';
    $('expression-error').textContent = '';
    $('expression-delete').hidden = !editId;
    $('expression-delete-confirm').hidden = true;
    $('expression-dialog').showModal();
    const preferred = document.getElementById('from')?.value;
    ($('term-' + preferred) || $('expression-fields').querySelector('input')).focus();
  }
  function render() {
    $('personal-count').textContent = String(rows.length);
    const filter = norm($('personal-filter').value), list = $('personal-list'); list.replaceChildren();
    const matches = rows.filter(row => !filter || Object.values(row.terms).some(value=>norm(value).includes(filter)) || norm(row.note).includes(filter)).sort((a,b)=>b.updatedAt-a.updatedAt);
    for (const row of matches.slice(0,100)) {
      const li = node('li'), button = node('button'); button.type = 'button';
      button.append(node('span',Object.values(row.terms).join(' · ')),node('small',Object.keys(row.terms).join(' / ').toUpperCase() + ' · Edit'));
      button.onclick = () => open(row); li.append(button); list.append(li);
    }
    if (!matches.length) list.append(node('li', filter ? 'No saved expression matches.' : 'Your expressions will appear here.', 'no-items'));
    if (matches.length > 100) list.append(node('li','Showing 100 of '+matches.length+'. Narrow your search.', 'no-items'));
  }
  function plan(entries, policy) {
    const next = new Map(), prints = new Map(), terms = new Map();
    let added = 0, skipped = 0, conflicts = 0, replaced = 0;
    function keys(row) {return Object.entries(row.terms).map(([lang,value])=>lang+':'+norm(value));}
    function insert(row) {
      next.set(row.id,row);
      const print=fingerprint(row);if(!prints.has(print))prints.set(print,new Set());prints.get(print).add(row.id);
      for(const key of keys(row)){if(!terms.has(key))terms.set(key,new Set());terms.get(key).add(row.id);}
    }
    function remove(id) {
      const row=next.get(id),print=fingerprint(row);next.delete(id);prints.get(print).delete(id);if(!prints.get(print).size)prints.delete(print);
      for(const key of keys(row)){terms.get(key).delete(id);if(!terms.get(key).size)terms.delete(key);}
    }
    rows.forEach(insert);
    for (const entry of entries) {
      if (prints.has(fingerprint(entry))) {skipped++; continue;}
      const matches = new Set(keys(entry).flatMap(key=>[...(terms.get(key)||[])]));
      if (matches.size) {
        conflicts++;
        if (policy === 'keep') continue;
        if (policy === 'replace') {for(const id of matches)remove(id);replaced += matches.size;}
      }
      insert({...entry,id:crypto.randomUUID(),createdAt:entry.createdAt ?? Date.now(),updatedAt:entry.updatedAt ?? Date.now()}); added++;
    }
    if (next.size > MAX) throw new Error('A sample can hold up to '+MAX.toLocaleString('en-US')+' personal expressions. Split this file or export and remove older entries first.');
    const result=[...next.values()];checkBackupSize(result);
    return {next:result, added, skipped, conflicts, replaced};
  }
  async function prepareImport(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a JSON backup smaller than 10 MB.');
    let payload;
    try {payload = JSON.parse((await file.text()).replace(/^\uFEFF/,''));} catch {throw new Error('This file is not valid JSON. Choose a personal dictionary export.');}
    if (!payload || payload.format !== FORMAT || payload.version !== VERSION || !Array.isArray(payload.entries) || payload.entries.length > MAX) throw new Error('Unsupported personal dictionary backup. Choose a version 1 personal dictionary export.');
    const entries = payload.entries.map(validate); // Validate the whole file before offering any write.
    await reload();
    const preview = plan(entries,'keep'); importing = entries;
    $('import-summary').textContent = entries.length+' expressions: '+preview.added+' new, '+preview.skipped+' exact duplicates, '+preview.conflicts+' with different translations or notes.';
    const box = $('import-preview');box.replaceChildren();
    for (const entry of entries.slice(0,20)) {
      const line=node('p',Object.entries(entry.terms).map(([lang,value])=>lang.toUpperCase()+': '+value).join(' · '));
      if(rows.some(row=>overlaps(row,entry)&&fingerprint(row)!==fingerprint(entry)))line.append(node('small','Different version already saved'));
      box.append(line);
    }
    if(entries.length>20)box.append(node('p','Previewing the first 20 expressions. All '+entries.length+' will be processed.'));
    $('import-error').textContent='';$('import-policy').value='keep';$('import-dialog').showModal();
  }
  function exportEntries() {
    const payload = {format:FORMAT,version:VERSION,programId:document.querySelector('meta[name="program-id"]').content,exportedAt:new Date().toISOString(),entries:rows.map(({terms,note,attribution,createdAt,updatedAt})=>({terms,note,attribution,createdAt,updatedAt})),notice:'Original source licenses and attribution continue to apply to copied dictionary expressions. See readme.html and licenses/.'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json;charset=utf-8'}));
    const a=node('a');a.href=url;a.download='UnicodeTranslate_Personal_'+payload.programId+'_'+Date.now()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    status(rows.length+' expressions exported. Keep this file as your backup.');
  }
  async function init(manifest) {
    languages=manifest.languages;
    try {
      db = await new Promise((resolve,reject)=>{
        const req=indexedDB.open('unicode-translate-personal-'+document.querySelector('meta[name="storage-key"]').content,1);
        req.onupgradeneeded=()=>req.result.createObjectStore('entries',{keyPath:'id'});
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
        req.onblocked=()=>status('Close older tabs of this sample to open your personal dictionary.',true);
      });
      db.onversionchange=()=>{db.close();initialized=false;status('Reload this sample to continue editing your personal dictionary.',true);for(const id of ['personal-add','personal-import','personal-export'])$(id).disabled=true;};
      const fields=$('expression-fields');
      for(const [lang,info] of Object.entries(languages)){
        const label=node('label',info.name), input=node('input');input.id='term-'+lang;input.name=lang;input.lang=lang;input.maxLength=4096;input.autocomplete='off';label.append(input);fields.append(label);
      }
      await reload();initialized=true;
      for(const id of ['personal-add','personal-import','personal-export'])$(id).disabled=false;
      status(rows.length ? rows.length+' expressions saved. Export regularly for a backup.' : 'Your personal dictionary is ready.');
      if(channel)channel.onmessage=()=>reload().catch(error=>status(error.message,true));
    } catch(error){status('Personal storage is unavailable. Base dictionary lookup still works. '+error.message,true);return;}
    $('personal-add').onclick=()=>{const terms={};if($('query').value.trim())terms[$('from').value]=$('query').value.trim();open({terms,note:'',attribution:[]});};
    $('personal-export').onclick=()=>{reload().then(exportEntries).catch(error=>status(error.message,true));};
    $('personal-import').onclick=()=>$('personal-file').click();
    $('personal-file').onchange=async()=>{const file=$('personal-file').files[0];$('personal-file').value='';if(!file)return;try{await prepareImport(file);}catch(error){status(error.message,true);}};
    $('personal-filter').oninput=render;
    $('expression-close').onclick=()=>$('expression-dialog').close();
    $('import-close').onclick=()=>{$('import-dialog').close();importing=null;};
    $('expression-form').onsubmit=async event=>{
      event.preventDefault();if(saving)return;saving=true;$('expression-save').disabled=true;
      try {
        const entry=validate({terms:Object.fromEntries(Object.keys(languages).map(lang=>[lang,$('term-'+lang).value])),note:$('expression-note').value,attribution});
        await new Promise((resolve,reject)=>{
          const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),request=store.getAll();let failure;
          request.onsuccess=()=>{
            try {
              const latest=request.result,old=latest.find(row=>row.id===editId);
              if(editId&&!old)throw new Error('This expression was deleted in another tab. Close the editor and add it again.');
              if(latest.some(row=>row.id!==editId&&fingerprint(row)===fingerprint(entry)))throw new Error('This exact expression is already saved.');
              if(!editId&&latest.length>=MAX)throw new Error('Personal dictionary limit reached. Export a backup and remove an older expression.');
              const row={...entry,id:editId||crypto.randomUUID(),createdAt:old?.createdAt??Date.now(),updatedAt:Date.now()};
              checkBackupSize([...latest.filter(existing=>existing.id!==row.id),row]);
              store.put(row);
            }catch(error){failure=error;abort(tx);}
          };
          tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(failure||tx.error||new Error('Save failed. Your existing expressions were not changed. Export a backup and check device storage.'));
        });
        $('expression-dialog').close();await changed('Expression saved. It is searchable in every language you supplied.');
      }catch(error){$('expression-error').textContent=error.message;}finally{saving=false;$('expression-save').disabled=false;}
    };
    $('expression-delete').onclick=()=>{$('expression-delete-confirm').hidden=false;};
    $('expression-delete-no').onclick=()=>{$('expression-delete-confirm').hidden=true;};
    $('expression-delete-yes').onclick=async()=>{
      if(saving)return;saving=true;
      try{await transaction('readwrite',store=>store.delete(editId));$('expression-dialog').close();await changed('Expression deleted.');}catch(error){$('expression-error').textContent=error.message;}finally{saving=false;}
    };
    $('import-form').onsubmit=async event=>{
      event.preventDefault();if(saving||!importing)return;saving=true;$('import-confirm').disabled=true;
      try{
        // Read and merge inside one read/write transaction so another tab cannot be overwritten.
        let summary;
        await new Promise((resolve,reject)=>{
          const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),request=store.getAll();
          request.onsuccess=()=>{
            try{rows=request.result;summary=plan(importing,$('import-policy').value);const keep=new Set(summary.next.map(row=>row.id));for(const row of rows)if(!keep.has(row.id))store.delete(row.id);for(const row of summary.next)store.put(row);}catch(error){$('import-error').textContent=error.message;abort(tx);}
          };
          tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||new Error($('import-error').textContent||'Import failed. Nothing was changed.'));
        });
        $('import-dialog').close();importing=null;
        await changed('Import complete: '+summary.added+' saved, '+summary.skipped+' duplicates skipped, '+summary.replaced+' replaced'+($('import-policy').value==='keep'?', '+summary.conflicts+' differing versions kept unchanged.':'.'));
      }catch(error){$('import-error').textContent=error.message;}finally{saving=false;$('import-confirm').disabled=false;}
    };
  }
  function search({from,to,query}) {
    return rows.filter(row=>row.terms[from]&&row.terms[to]&&norm(row.terms[from])===norm(query)).map(row=>({id:'personal:'+row.id,personal:true,pos:'Your expression',words:Object.fromEntries(Object.entries(row.terms).map(([lang,value])=>[lang,[[value,[]]]])),definitions:{},notes:row.note?[row.note]:[],attribution:row.attribution,entry:row}));
  }
  function suggest(lang,query){const prefix=norm(query);return [...new Set(rows.filter(row=>row.terms[lang]&&norm(row.terms[lang]).startsWith(prefix)).map(row=>row.terms[lang]))].slice(0,8);}
  function addSense(sense,item,manifest){
    if(!initialized){status('Personal storage is unavailable. Export lookup is still available.',true);return;}
    if(sense.personal){open(sense.entry);return;}
    const ids=new Set(Object.values(sense.words).flatMap(words=>words.flatMap(([,sources])=>sources)));
    for(const sources of Object.values(sense.definitionSources||{}))for(const id of sources)ids.add(id);
    const terms=Object.fromEntries(Object.entries(sense.words).map(([lang,words])=>[lang,words[0][0]]));
    open({terms,note:'Source sense: '+sense.id,attribution:[...ids].map(id=>({id,license:manifest.sources[id].license,url:manifest.sources[id].url}))});
  }
  return {init,search,suggest,addSense};
})();
