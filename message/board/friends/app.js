'use strict';
const $ = id => document.getElementById(id);
const remote = (window.BOARD_API || '').replace(/\/$/, '');
const apiRoot = remote || (location.hostname.endsWith('github.io') ? '' : location.origin);
let token = '', currentName = '', busy = false, polling = false, newest = 0, oldest = 0, sendNonce = '', lastDraft = '';
const seen = new Set();
let setupToken = new URLSearchParams(location.hash.slice(1)).get('setup') || '';
if (setupToken) history.replaceState(null, '', location.pathname + location.search);
try { token = sessionStorage.getItem('7E2BD608C39A45F1') || ''; } catch (_) {}
const formatter = new Intl.DateTimeFormat('hu-HU', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
function notify(message) { $('notice').textContent = message; $('notice').hidden = false; }
function clearNotice() { $('notice').hidden = true; }
function connection(ok, label) { $('liveText').textContent = label; $('liveDot').parentElement.classList.toggle('connected', ok); }
function storeToken(value) { token = value; try { if(value) sessionStorage.setItem('7E2BD608C39A45F1', value); else sessionStorage.removeItem('7E2BD608C39A45F1'); } catch (_) {} }
function showLogin() { storeToken(''); $('login').hidden = false; $('wall').hidden = true; $('setup').hidden = true; }
async function api(path, body) {
  if (!apiRoot) throw new Error('A háttérszolgáltatás még nincs bekapcsolva. Az üzenőfal előkészítése folyamatban van.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(apiRoot + path, {method:body === undefined ? 'GET':'POST', headers:{...(token ? {Authorization:'Bearer '+token}:{}), ...(body === undefined ? {} : {'Content-Type':'application/json'})}, body:body === undefined ? undefined : JSON.stringify(body), signal:controller.signal, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer'});
    const result = await response.json().catch(() => ({}));
    if(!response.ok) { if(response.status === 401 && path !== '/api/login') showLogin(); throw new Error(result.error || 'A szolgáltatás most nem elérhető. Próbáld újra kicsit később.'); }
    return result;
  } catch(error) {
    if(error.name === 'AbortError' || error instanceof TypeError) throw new Error('Nem sikerült kapcsolódni. Ellenőrizd az internetkapcsolatot, majd próbáld újra.');
    throw error;
  } finally { clearTimeout(timer); }
}
function scrollBottom() { $('messages').scrollTop = $('messages').scrollHeight; $('newMessages').hidden = true; }
function nearBottom() { return $('messages').scrollHeight - $('messages').scrollTop - $('messages').clientHeight < 90; }
function render(rows, prepend = false) {
  const list = $('messages');
  const fragment = document.createDocumentFragment();
  let added = 0;
  for(const item of rows) {
    if(seen.has(item.id)) continue;
    seen.add(item.id); added++;
    newest = Math.max(newest,item.id); oldest = oldest ? Math.min(oldest,item.id) : item.id;
    const article = document.createElement('article'); article.className = 'message' + (item.name === currentName ? ' mine' : '');
    const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.textContent = Array.from(item.name).slice(0,2).join('').toLocaleUpperCase('hu-HU'); avatar.setAttribute('aria-hidden','true');
    const content = document.createElement('div');
    const meta = document.createElement('div'); meta.className = 'message-meta';
    const author = document.createElement('strong'); author.textContent = item.name;
    const date = document.createElement('time'); const d = new Date(item.created*1000); date.dateTime = d.toISOString(); date.textContent = formatter.format(d);
    const body = document.createElement('p'); body.className = 'message-body'; body.textContent = item.body;
    meta.append(author,date); content.append(meta,body); article.append(avatar,content); fragment.append(article);
  }
  if(added) $('empty').hidden = true;
  if(prepend) list.prepend(fragment); else list.append(fragment);
  return added;
}
async function openWall() {
  const result = await api('/api/messages');
  currentName = result.name; $('userName').textContent = currentName;
  seen.clear(); newest = 0; oldest = 0;
  $('messages').querySelectorAll('.message').forEach(item => item.remove()); $('empty').hidden = false;
  render(result.messages); $('older').hidden = !result.hasOlder;
  $('login').hidden = true; $('setup').hidden = true; $('wall').hidden = false;
  connection(true,'Minden üzenet naprakész'); clearNotice(); scrollBottom();
  if(typeof restoreBoardNotifications === 'function') await restoreBoardNotifications();
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('loginButton').disabled = true; clearNotice();
  try { const result = await api('/api/login', {name:$('name').value.trim(),password:$('password').value}); storeToken(result.token); $('password').value = ''; await openWall(); }
  catch(error) { notify(error.message); }
  finally { $('loginButton').disabled = false; }
});
$('setupForm').addEventListener('submit', async event => {
  event.preventDefault();
  if($('newPassword').value !== $('confirmPassword').value) return notify('A két jelszó nem egyezik.');
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try { await api('/api/setup', {setupToken,password:$('newPassword').value}); setupToken = ''; $('setupForm').reset(); showLogin(); notify('A közös jelszó elkészült. Most már beléphetsz.'); }
  catch(error) { notify(error.message); }
  finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => { try { await api('/api/logout', {}); } catch (_) {} showLogin(); $('message').value = ''; $('counter').textContent = '0'; });
$('message').addEventListener('input', () => { $('counter').textContent = $('message').value.length; });
$('message').addEventListener('keydown', event => { if((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('messageForm').requestSubmit(); } });
$('messageForm').addEventListener('submit', async event => {
  event.preventDefault(); if(busy) return;
  const body = $('message').value.trim(); if(!body) return;
  if(!sendNonce || lastDraft !== body) { sendNonce = crypto.randomUUID(); lastDraft = body; }
  busy = true; $('sendButton').disabled = true; clearNotice();
  try {
    await api('/api/messages', {body,nonce:sendNonce});
    // Fetch all unseen messages in order; inserting only our reply could skip concurrent messages.
    await poll(true);
    if($('message').value.trim() === body) { $('message').value = ''; $('counter').textContent = '0'; }
    sendNonce = ''; lastDraft = ''; scrollBottom();
  } catch(error) { notify(error.message); }
  finally { busy = false; $('sendButton').disabled = false; }
});
async function poll(force = false) {
  if(polling || !token || $('wall').hidden || (!force && document.hidden)) return;
  polling = true;
  try {
    const bottom = nearBottom(); let count = 0; let rows;
    do { const result = await api('/api/messages?after=' + newest); rows = result.messages; count += render(rows); } while(rows.length === 100 && token);
    connection(true,'Minden üzenet naprakész');
    if(count && bottom) scrollBottom(); else if(count) $('newMessages').hidden = false;
  } catch(error) { connection(false,'Kapcsolódás újra…'); if(!$('wall').hidden) notify(error.message); }
  finally { polling = false; }
}
$('older').addEventListener('click', async () => {
  $('older').disabled = true;
  try { const list = $('messages'); const height = list.scrollHeight; const result = await api('/api/messages?before=' + oldest); render(result.messages, true); list.scrollTop += list.scrollHeight - height; $('older').hidden = !result.hasOlder; }
  catch(error) { notify(error.message); }
  finally { $('older').disabled = false; }
});
$('newMessages').addEventListener('click', scrollBottom);
$('messages').addEventListener('scroll', () => { if(nearBottom()) $('newMessages').hidden = true; });
document.addEventListener('visibilitychange', () => { if(!document.hidden) poll(); });
setInterval(poll, 10000);
(async () => {
  if(setupToken) { $('login').hidden = true; $('setup').hidden = false; return; }
  if(token) { try { await openWall(); } catch(error) { showLogin(); notify(error.message); } }
  else if(!apiRoot) notify('Az üzenőfal elkészült. A háttérszolgáltatás bekapcsolására vár.');
})();
