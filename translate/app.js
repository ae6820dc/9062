/* Shared UI. Program identities are supplied by each launcher, never reused as storage keys. */
'use strict';
const $ = id => document.getElementById(id);
const programId = document.querySelector('meta[name="program-id"]').content;
const storageKey = document.querySelector('meta[name="storage-key"]').content;
const settingsKey = 'unicode-translate:' + storageKey + ':v1';
const fmt = n => n.toLocaleString('en-US');
const size = n => n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const normalized = s => s.trim().normalize('NFC').toLowerCase().normalize('NFC');
let settings = {from:'hu', to:'en', history:[], favorites:[]};
let manifest, worker, current, nextPage, activeTab = 'history', searchSequence = 0, suggestionSequence = 0, downloadActive = false;
let debounce, busy = false;
const pending = new Map();
let messageId = 0;
try {
  const saved = JSON.parse(localStorage.getItem(settingsKey));
  if (saved && typeof saved === 'object') {
    if (typeof saved.from === 'string') settings.from = saved.from;
    if (typeof saved.to === 'string') settings.to = saved.to;
    for (const k of ['history','favorites']) if (Array.isArray(saved[k])) settings[k] = saved[k].filter(x => x && typeof x.query === 'string' && x.query.length <= 4096 && typeof x.from === 'string' && typeof x.to === 'string').slice(0, k === 'history' ? 50 : 500);
  }
} catch { /* A corrupt or unavailable settings store must not prevent lookup. */ }
function save() {
  try { localStorage.setItem(settingsKey, JSON.stringify(settings)); }
  catch { setStatus('Settings could not be saved on this device. Dictionary lookup is still available.', true); }
}
function rpc(method, args = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, {resolve,reject});
    worker.postMessage({id,method,args});
  });
}
function setStatus(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function pair() { return {from:$('from').value, to:$('to').value}; }
function identity(item) { return item.from + ':' + item.to + ':' + normalized(item.query); }
function validPair(item) { return Object.hasOwn(manifest.languages,item.from) && Object.hasOwn(manifest.languages,item.to) && item.from !== item.to; }
function isFavorite(item) { return settings.favorites.some(x => identity(x) === identity(item)); }
function updateFavorite() {
  $('favorite').disabled = !current;
  $('favorite').textContent = current && isFavorite(current) ? '★ Saved' : '☆ Save';
}
function renderLibrary() {
  const list = $('library-list'); list.replaceChildren();
  const rows = settings[activeTab];
  if (!rows.length) list.append(element('li', activeTab === 'history' ? 'Your recent searches will appear here.' : 'Save a lookup with ☆ Save.', 'no-items'));
  for (const item of rows) {
    if (!validPair(item)) continue;
    const li = element('li');
    const button = element('button', item.query);
    button.type = 'button';
    button.append(element('small', manifest.languages[item.from].name + ' → ' + manifest.languages[item.to].name));
    button.addEventListener('click', () => {
      $('from').value = item.from; $('to').value = item.to; $('query').value = item.query;
      changedLanguages(); runSearch();
    });
    li.append(button);
    if (activeTab === 'favorites') {
      const remove = element('button','×','subtle');
      remove.type = 'button'; remove.setAttribute('aria-label', 'Remove favorite ' + item.query);
      remove.onclick = () => {settings.favorites = settings.favorites.filter(x => identity(x) !== identity(item)); save(); renderLibrary(); updateFavorite();};
      li.append(remove);
    }
    list.append(li);
  }
  $('clear-history').hidden = activeTab !== 'history' || !rows.length;
}
function hideSuggestions() { ++suggestionSequence; $('suggestions').hidden = true; $('suggestions').replaceChildren(); }
async function suggestions() {
  const sequence = ++suggestionSequence;
  const query = $('query').value;
  if (!query.trim() || !manifest) return hideSuggestions();
  const lang = $('from').value;
  try {
    const words = await rpc('suggest', {lang,query});
    if (sequence !== suggestionSequence || $('query').value !== query || lang !== $('from').value) return;
    const list = $('suggestions'); list.replaceChildren();
    for (const word of words) {
      const li = element('li'), button = element('button',word);
      button.type = 'button';
      button.onclick = () => {$('query').value = word; hideSuggestions(); runSearch();};
      li.append(button); list.append(li);
    }
    list.hidden = !words.length;
  } catch { if (sequence === suggestionSequence) $('suggestions').hidden = true; }
}
function renderSense(sense, item) {
  const section = element('article',undefined,'sense');
  const heading = element('div',undefined,'sense-heading');
  const sourceForms = sense.words[item.from].map(([word]) => word);
  heading.append(element('h2',sourceForms.filter(w => normalized(w) === normalized(item.query)).join(' · ') || sourceForms[0]));
  const pos = {n:'noun',v:'verb',a:'adjective',s:'adjective',r:'adverb'}[sense.pos] || sense.pos;
  if (pos) heading.append(element('span',pos,'tag'));
  section.append(heading);
  section.append(element('p',sense.words[item.to].map(([word]) => word).join(' · '),'translations'));
  const definitionLanguages = [...new Set([item.from, item.to, 'en'])];
  for (const lang of definitionLanguages) {
    for (const definition of sense.definitions[lang] || []) section.append(element('p',manifest.languages[lang].name + ': ' + definition,'definition'));
  }
  if (sourceForms.length > 1) section.append(element('p','Source alternatives: ' + sourceForms.join(' · '),'sense-notes'));
  if (sense.notes.length) section.append(element('p',sense.notes.join(' · '),'sense-notes'));
  const provenance = element('div',undefined,'source-links');
  const ids = new Set([...sense.words[item.from], ...sense.words[item.to]].flatMap(([,ids]) => ids));
  for (const lang of definitionLanguages) for (const id of sense.definitionSources?.[lang] || []) ids.add(id);
  provenance.append(document.createTextNode(sense.id + ' · '));
  let first = true;
  for (const id of ids) {
    if (!first) provenance.append(document.createTextNode(' · ')); first = false;
    const source = manifest.sources[id];
    const link = element('a',id + ' (' + source.license + ')');
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    provenance.append(link);
  }
  section.append(provenance);
  return section;
}
async function runSearch(append = false) {
  if (!manifest) return;
  clearTimeout(debounce); hideSuggestions();
  const item = {...pair(), query:$('query').value.trim()};
  if (!item.query) {setStatus('Enter a word or phrase to look up.'); $('query').focus(); return;}
  const sequence = ++searchSequence;
  const offset = append ? nextPage : 0;
  busy = true;
  $('search').disabled = true; $('more').disabled = true;
  setStatus('Looking up source-backed meanings…');
  if (!append) {current = null; nextPage = null; $('results').replaceChildren(); $('copy').disabled = true; updateFavorite();}
  try {
    const result = await rpc('search', {...item,offset});
    if (sequence !== searchSequence) return;
    if (append) current.results.push(...result.results);
    else current = {...item, results:result.results};
    nextPage = result.next;
    for (const sense of result.results) $('results').append(renderSense(sense,item));
    if (!current.results.length) {
      const empty = element('div',undefined,'empty');
      empty.append(element('h2',result.forms.length ? 'No attested translation for this pair.' : 'No exact dictionary entry.'));
      empty.append(element('p',result.forms.length ? 'The source entry exists, but these datasets do not connect it to the target language. Try another target.' : 'Check the spelling, try a base form, or choose a search suggestion. Diacritics are kept distinct.'));
      $('results').append(empty);
    }
    setStatus(`${fmt(current.results.length)} matching sense${current.results.length === 1 ? '' : 's'} shown for “${item.query}”. ${nextPage !== null ? 'More source senses available.' : 'All available senses checked.'}`);
    $('more').hidden = nextPage === null;
    $('copy').disabled = !current.results.length;
    updateFavorite();
    const historyItem = {...item,at:Date.now()};
    settings.history = [historyItem,...settings.history.filter(x => identity(x) !== identity(item))].slice(0,50);
    save(); renderLibrary();
    refreshDownloads().catch(() => {});
  } catch (error) {
    if (sequence === searchSequence) {setStatus(error.message, true); $('more').hidden = true;}
  } finally {
    if (sequence === searchSequence) {busy = false; $('search').disabled = false; $('more').disabled = false;}
  }
}
function renderCoverage() {
  const grid = $('language-counts');
  for (const lang of Object.values(manifest.languages)) {
    const card = element('div',undefined,'language-stat');
    card.append(element('span',lang.name,'name'),element('strong',fmt(lang.headwords)),element('small','headwords / 100,000 target'));
    card.title = `${fmt(lang.headwordSenses)} headword–sense associations; ${fmt(lang.lookupForms)} indexed lookup forms including translation phrases`;
    grid.append(card);
  }
  const table = $('pair-table');
  const head = element('thead'), row = element('tr');
  const th = element('th','From ↓ / To →'); th.scope = 'col'; row.append(th);
  for (const [code,lang] of Object.entries(manifest.languages)) {const th = element('th',code.toUpperCase()); th.title = lang.name; th.scope = 'col'; row.append(th);}
  head.append(row); table.append(head);
  const body = element('tbody');
  for (const [a,l] of Object.entries(manifest.languages)) {
    const row = element('tr'), th = element('th',l.name); th.scope = 'row'; row.append(th);
    for (const b of Object.keys(manifest.languages)) {
      const coverage = manifest.pairs[a+'-'+b];
      const td = element('td',a === b ? '—' : fmt(coverage.sourceForms));
      if (coverage) td.title = `${fmt(coverage.sourceHeadwords)} source headwords; ${fmt(coverage.alignedSenses)} aligned senses`;
      row.append(td);
    }
    body.append(row);
  }
  table.append(body);
}
function changedLanguages() {
  ++searchSequence; busy = false; $('search').disabled = false;
  hideSuggestions(); clearTimeout(debounce);
  settings.from = $('from').value; settings.to = $('to').value; save();
  const p = manifest.pairs[settings.from+'-'+settings.to];
  $('pair-count').textContent = `${fmt(p.sourceForms)} source lookup forms · ${fmt(p.alignedSenses)} aligned senses in this direction`;
  $('query').lang = settings.from;
  current = null; nextPage = null; $('results').replaceChildren(); $('copy').disabled = true; $('more').hidden = true; updateFavorite();
  setStatus('Ready. Enter a word or phrase.');
  refreshDownloads().catch(e => {$('download-status').textContent = e.message;});
}
async function refreshDownloads() {
  const snapshot = await rpc('status');
  const lang = $('from').value, info = snapshot.languages[lang];
  $('download-info').textContent = `${manifest.languages[lang].name}: ${info.done}/${info.total} required chunks on device. ${size(info.remainingBytes)} compressed data remaining (${size(info.totalBytes)} total). Storage used after indexing is larger.`;
  if (!downloadActive) {
    $('download-progress').max = info.total; $('download-progress').value = info.done;
    $('download').textContent = info.done === info.total ? '✓ Source language downloaded' : 'Download ' + manifest.languages[lang].name;
    $('download').disabled = info.done === info.total;
  }
}
async function downloadSource() {
  if (downloadActive) return;
  downloadActive = true;
  const lang = $('from').value;
  $('download').disabled = true; $('cancel').hidden = false;
  $('download-status').textContent = 'Downloading ' + manifest.languages[lang].name + '. You can keep searching.';
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
    const result = await rpc('download',{lang});
    $('download-status').textContent = result.cancelled ? 'Paused. Completed chunks are saved; download again to resume.' : manifest.languages[lang].name + ' is ready for offline lookup to every available target.';
  } catch (error) { $('download-status').textContent = error.message; }
  finally {downloadActive = false; $('cancel').hidden = true; await refreshDownloads();}
}
async function copyResults() {
  if (!current) return;
  const text = current.query + ' (' + current.from + ' → ' + current.to + ')\n' + current.results.map(s => s.words[current.to].map(([w]) => w).join('; ')).join('\n');
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = element('textarea',text); document.body.append(area); area.select();
      const ok = document.execCommand('copy'); area.remove(); if (!ok) throw new Error('Clipboard unavailable');
    }
    setStatus('Translations copied.');
  } catch {setStatus('Clipboard permission is unavailable. Select the translation text and copy it.',true);}
}
function exportLookups() {
  const timestamp = Date.now();
  const content = {programId, timestamp, datasetVersion:manifest?.version || null,
    lookup:current, history:settings.history, favorites:settings.favorites,
    attribution:manifest?.sources || {}, notice:'Dataset licenses apply to exported lexical content. See readme.html and licenses/.'};
  const blob = new Blob([JSON.stringify(content,null,2)],{type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob), a = element('a');
  a.href = url; a.download = `UnicodeTranslate_${programId}_${timestamp}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
}
function updateConnection() { $('connection').textContent = navigator.onLine ? '● Online · offline downloads available' : '● Offline · using downloaded data'; }
async function setupOffline() {
  if (!('serviceWorker' in navigator)) { $('shell-status').textContent = 'Service workers unavailable. Use HTTPS or localhost for offline app launch.'; return; }
  try {
    const reg = await navigator.serviceWorker.register('sw.js',{scope:'./'});
    await navigator.serviceWorker.ready;
    const markReady = () => {$('shell-status').textContent = '✓ Application shell ready offline. Dictionary download is separate.';};
    if (reg.active) markReady();
    else navigator.serviceWorker.addEventListener('controllerchange',markReady,{once:true});
  } catch { $('shell-status').textContent = 'Offline app installation failed. Online dictionary lookup is available; retry over HTTPS.'; }
}
async function start() {
  updateConnection();
  for (const a of document.querySelectorAll('.sample-nav a')) if (a.pathname === location.pathname) a.setAttribute('aria-current','page');
  if (!/^[0-9A-F]{16}$/.test(programId) || !/^[0-9A-F]{16}$/.test(storageKey) || programId === storageKey) throw new Error('Invalid program identity');
  worker = new Worker('dictionary-worker.js');
  worker.onmessage = ({data}) => {
    if (data.event === 'downloadProgress') {
      $('download-progress').max = data.total; $('download-progress').value = data.done;
      $('download-status').textContent = `${manifest.languages[data.lang].name}: ${data.done}/${data.total} chunks saved.`;
      return;
    }
    const job = pending.get(data.id); if (!job) return;
    pending.delete(data.id); data.error ? job.reject(new Error(data.error)) : job.resolve(data.result);
  };
  worker.onerror = () => {for (const job of pending.values()) job.reject(new Error('Dictionary worker failed. Reload the application to retry.')); pending.clear();};
  manifest = await rpc('init');
  for (const id of ['from','to']) {
    for (const [code,l] of Object.entries(manifest.languages)) {const option = element('option',l.name + ' · ' + l.native); option.value = code; $(id).append(option);}
    $(id).disabled = false;
  }
  if (!validPair(settings)) {settings.from = 'hu'; settings.to = 'en';}
  $('from').value = settings.from; $('to').value = settings.to;
  $('query').disabled = false; $('search').disabled = false; $('swap').disabled = false; $('download').disabled = false;
  settings.history = settings.history.filter(validPair); settings.favorites = settings.favorites.filter(validPair);
  renderCoverage(); renderLibrary(); changedLanguages();
}
$('search-form').onsubmit = event => {event.preventDefault(); runSearch();};
$('more').onclick = () => {if (!busy) runSearch(true);};
$('query').addEventListener('input',() => {
  clearTimeout(debounce); hideSuggestions(); ++searchSequence;
  current = null; nextPage = null; updateFavorite(); $('copy').disabled = true; $('more').hidden = true;
  busy = false; $('search').disabled = !manifest;
  // Network suggestions begin only after the user pauses typing.
  debounce = setTimeout(suggestions,300);
});
$('query').addEventListener('keydown',e => {
  if (e.key === 'Escape') hideSuggestions();
  if (e.key === 'ArrowDown' && !$('suggestions').hidden) {e.preventDefault(); $('suggestions').querySelector('button')?.focus();}
});
$('suggestions').addEventListener('keydown',e => {
  if (e.key === 'Escape') {hideSuggestions(); $('query').focus();}
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); const buttons = [...$('suggestions').querySelectorAll('button')];
    const i = buttons.indexOf(document.activeElement), delta = e.key === 'ArrowDown' ? 1 : -1;
    buttons[(i + delta + buttons.length) % buttons.length]?.focus();
  }
});
document.addEventListener('click',e => {if (!$('search-form').contains(e.target)) hideSuggestions();});
$('clear').onclick = () => {
  $('query').value = ''; hideSuggestions(); clearTimeout(debounce); ++searchSequence;
  current = null; nextPage = null; $('results').replaceChildren(); $('more').hidden = true; $('copy').disabled = true; updateFavorite();
  busy = false; $('search').disabled = !manifest; setStatus('Search cleared.'); $('query').focus();
};
$('swap').onclick = () => {const old = $('from').value; $('from').value = $('to').value; $('to').value = old; changedLanguages();};
$('from').onchange = () => {if ($('from').value === $('to').value) $('to').value = settings.from; changedLanguages();};
$('to').onchange = () => {if ($('from').value === $('to').value) $('from').value = settings.to; changedLanguages();};
$('favorite').onclick = () => {
  if (!current) return;
  if (isFavorite(current)) settings.favorites = settings.favorites.filter(x => identity(x) !== identity(current));
  else if (settings.favorites.length < 500) settings.favorites.unshift({query:current.query,from:current.from,to:current.to,at:Date.now()});
  else {setStatus('Favorites limit reached (500). Remove a favorite before saving another.',true); return;}
  save(); updateFavorite(); renderLibrary();
};
for (const tab of ['history','favorites']) $(tab+'-tab').onclick = () => {
  activeTab = tab;
  for (const t of ['history','favorites']) {$(t+'-tab').classList.toggle('active',t === tab); $(t+'-tab').setAttribute('aria-pressed',String(t === tab));}
  renderLibrary();
};
$('clear-history').onclick = () => {settings.history = []; save(); renderLibrary();};
$('copy').onclick = copyResults; $('export').onclick = exportLookups;
$('download').onclick = downloadSource;
$('cancel').onclick = () => {rpc('cancel').catch(() => {}); $('download-status').textContent = 'Pausing after the current chunk…';};
window.addEventListener('online',updateConnection); window.addEventListener('offline',updateConnection);
setupOffline();
start().catch(error => setStatus(error.message,true));
