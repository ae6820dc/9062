/* Dictionary engine: bounded shards, off-main-thread decompression, indexed disk lookup. */
'use strict';
let manifest, db, initialized, downloadJob;
const inflight = new Map();
const generations = {search:0, suggest:0};
let activeImports = 0;
const importQueue = [];
async function acquireImport() {
  if (activeImports >= 2) await new Promise(resolve => importQueue.push(resolve));
  else activeImports++;
}
function releaseImport() { const next = importQueue.shift(); if (next) next(); else activeImports--; }
function isCurrent(method, generation) {
  if (generations[method] !== generation) throw new Error('Lookup superseded');
}
const normalize = s => s.trim().normalize('NFC').toLowerCase().normalize('NFC');
const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const completed = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('Storage transaction failed')); });
function transaction(store, mode = 'readonly') { return db.transaction(store, mode); }
async function get(store, key) { return request(transaction(store).objectStore(store).get(key)); }

async function init() {
  if (initialized) return initialized;
  initialized = (async () => {
    if (!self.crypto?.subtle) throw new Error('Use HTTPS or localhost for secure dictionary verification.');
    if (!self.indexedDB || !self.DecompressionStream) throw new Error('This browser needs IndexedDB and gzip DecompressionStream. Use a current Chrome, Edge, Firefox or Safari.');
    const response = await fetch('data/manifest.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('Dictionary manifest is unavailable. Open online once to install the app.');
    manifest = await response.json();
    if (manifest.schema !== 1) throw new Error('Unsupported dictionary format');
    const opening = indexedDB.open('unicode-translate-dictionary-' + manifest.version, 1);
    opening.onupgradeneeded = () => {
      const database = opening.result;
      const lex = database.createObjectStore('lex', {keyPath: 'key'});
      lex.createIndex('lookup', ['lang', 'norm'], {unique: true});
      database.createObjectStore('concepts', {keyPath: 'id'});
      database.createObjectStore('chunks', {keyPath: 'path'});
    };
    db = await request(opening);
    db.onversionchange = () => db.close();
    return manifest;
  })();
  return initialized;
}

function rangeShard(shards, key) {
  let low = 0, high = shards.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (shards[mid].last < key) low = mid + 1; else high = mid;
  }
  return low;
}

// Only a single compressed shard and its bounded decompressed records are held
// during import. IndexedDB is the persistent database, not an in-memory mirror.
async function ensure(meta, store) {
  if (inflight.has(meta.path)) return inflight.get(meta.path);
  const job = (async () => {
    if (await get('chunks', meta.path)) return;
    await acquireImport();
    try {
    let response;
    try { response = await fetch('data/' + meta.path, {cache: 'no-store'}); }
    catch { throw new Error('This data is not downloaded. Connect to the internet and retry, or download the source language for offline lookup.'); }
    if (!response.ok) throw new Error(`Dictionary download failed (${response.status}). Retry when connected.`);
    const compressed = await response.arrayBuffer();
    if (compressed.byteLength !== meta.bytes) throw new Error('Dictionary shard has the wrong size. No data was installed.');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', compressed)), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== meta.sha256) throw new Error('Dictionary integrity check failed. No data was installed.');
    const raw = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if (raw.byteLength !== meta.rawBytes) throw new Error('Invalid uncompressed dictionary size');
    const records = new TextDecoder('utf-8', {fatal:true}).decode(raw).trimEnd().split('\n').map(JSON.parse);
    if (records.length !== meta.count) throw new Error('Invalid dictionary record count');
    const tx = db.transaction([store, 'chunks'], 'readwrite');
    const done = completed(tx);
    for (const record of records) tx.objectStore(store).put(record);
    tx.objectStore('chunks').put({path:meta.path, bytes:meta.bytes, records:records.length});
    await done; // Marker and records commit together; interrupted downloads can resume safely.
    } finally { releaseImport(); }
  })();
  inflight.set(meta.path, job);
  try { await job; } finally { inflight.delete(meta.path); }
}

function checkLanguage(lang) {
  if (!Object.hasOwn(manifest.languages, lang)) throw new Error('Unknown dictionary language');
}

async function lexicon(lang, query) {
  const shards = manifest.languages[lang].shards;
  const i = rangeShard(shards, query);
  if (i === shards.length || shards[i].first > query) return undefined;
  await ensure(shards[i], 'lex');
  return get('lex', lang + ':' + query);
}

async function suggest({lang, query}, generation) {
  checkLanguage(lang);
  const q = normalize(query);
  if (!q) return [];
  const shards = manifest.languages[lang].shards;
  const start = rangeShard(shards, q);
  const results = [];
  for (let i = start; i < shards.length && results.length < 8; i++) {
    isCurrent('suggest', generation);
    const m = shards[i];
    if (m.first > q && !m.first.startsWith(q)) break;
    await ensure(m, 'lex');
    const tx = transaction('lex');
    const done = completed(tx);
    // Compound index restricts the cursor to this source language and prefix.
    const range = IDBKeyRange.bound([lang, q], [lang, q + '\uffff']);
    await new Promise((resolve, reject) => {
      const r = tx.objectStore('lex').index('lookup').openCursor(range);
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const cursor = r.result;
        if (!cursor || results.length === 8) return resolve();
        if (cursor.value.norm >= m.first && cursor.value.norm <= m.last && cursor.value.norm.startsWith(q)) results.push(cursor.value.forms[0]);
        cursor.continue();
      };
    });
    await done;
  }
  return results;
}

async function search({from, to, query, offset = 0}, generation) {
  checkLanguage(from); checkLanguage(to);
  if (from === to) throw new Error('Choose two different languages');
  const q = normalize(query);
  if (!q || q.length > 4096) throw new Error('Enter a word or phrase of up to 4096 characters');
  const lex = await lexicon(from, q);
  if (!lex) return {results:[], forms:[], next:null, totalSenses:0};
  const results = [];
  const bit = 1 << manifest.targetLanguages.indexOf(to);
  const matchingSenses = lex.senses.filter((_, index) => lex.masks[index] & bit);
  let i = offset;
  for (; i < matchingSenses.length && results.length < 12; i++) {
    isCurrent('search', generation);
    const key = matchingSenses[i];
    const j = rangeShard(manifest.concepts, key);
    const m = manifest.concepts[j];
    if (!m || m.first > key) throw new Error('Missing sense partition');
    await ensure(m, 'concepts');
    const sense = await get('concepts', key);
    if (!sense) throw new Error('Incomplete dictionary record');
    if (sense.words[to]?.length) results.push(sense);
  }
  return {results, forms:lex.forms, next:i < matchingSenses.length ? i : null, totalSenses:lex.senses.length};
}

function required(lang) {
  const l = manifest.languages[lang];
  return [...l.shards.map(m => [m, 'lex']), ...l.concepts.map(i => [manifest.concepts[i], 'concepts'])];
}

async function status() {
  const rows = await request(transaction('chunks').objectStore('chunks').getAll());
  const installed = new Set(rows.map(x => x.path));
  const languages = {};
  for (const lang of Object.keys(manifest.languages)) {
    const all = required(lang);
    languages[lang] = {done:all.filter(([m]) => installed.has(m.path)).length, total:all.length,
      totalBytes:all.reduce((sum, [m]) => sum + m.bytes, 0),
      remainingBytes:all.reduce((sum, [m]) => sum + (installed.has(m.path) ? 0 : m.bytes), 0)};
  }
  return {languages, bytes:rows.reduce((sum, r) => sum + r.bytes, 0), chunks:rows.length};
}

async function download({lang}) {
  checkLanguage(lang);
  if (downloadJob) throw new Error('A download is already running');
  const job = {cancelled:false};
  downloadJob = job;
  const all = required(lang);
  try {
    for (let i = 0; i < all.length; i++) {
      if (job.cancelled) return {cancelled:true};
      await ensure(...all[i]);
      postMessage({event:'downloadProgress', lang, done:i + 1, total:all.length});
    }
    return {cancelled:false};
  } finally { downloadJob = undefined; }
}

onmessage = async ({data:{id, method, args}}) => {
  const generation = Object.hasOwn(generations, method) ? ++generations[method] : undefined;
  try {
    await init();
    let result;
    if (method === 'init') result = manifest;
    else if (method === 'search') result = await search(args, generation);
    else if (method === 'suggest') result = await suggest(args, generation);
    else if (method === 'status') result = await status();
    else if (method === 'download') result = await download(args);
    else if (method === 'cancel') { if (downloadJob) downloadJob.cancelled = true; result = true; }
    else throw new Error('Unknown dictionary operation');
    postMessage({id, result});
  } catch (error) {
    postMessage({id, error:error.name === 'QuotaExceededError' ? 'Device storage is full. Free space and retry; completed chunks are preserved.' : error.message});
  }
};
