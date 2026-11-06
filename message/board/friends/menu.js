'use strict';
// This local menu code prevents accidental actions; the board password is verified by the server.
(() => {
  const el = id => document.getElementById(id);
  const unlock = el('menuUnlock'), menu = el('boardMenu'), login = el('loginDialog'), share = el('shareDialog');
  let unlocked = false, loginAuthorized = false, timer;
  const dialogs = [unlock, menu, login, share];
  const hasSession = () => typeof token === 'string' && !!token;
  function closeMenu() { unlocked = false; clearTimeout(timer); if(menu.open) menu.close(); }
  function reset() {
    closeMenu(); loginAuthorized = false;
    for(const dialog of dialogs) if(dialog.open) dialog.close();
    el('menuPin').value = ''; el('password').value = ''; el('menuPinError').hidden = true;
    sync();
  }
  function sync() {
    const signedIn = hasSession();
    el('menuSession').textContent = signedIn ? 'Bejelentkezve: ' + currentName : 'Nincs bejelentkezve';
    el('menuLogin').hidden = signedIn;
    for(const id of ['notifications','logout','refreshWall']) el(id).hidden = !signedIn;
  }
  function consume(action) {
    const known = ['login','notifications','logout','share','copy','refresh'];
    if(!known.includes(action) || !unlocked || !menu.open || document.hidden) return false;
    if(['notifications','logout','refresh'].includes(action) && !hasSession()) return false;
    closeMenu(); return true;
  }
  window.boardMenu = {consume, reset, sync, allowLogin: () => loginAuthorized && login.open && !document.hidden};
  el('boardMenuOpen').addEventListener('click', () => {
    reset(); unlock.showModal(); el('menuPin').focus({preventScroll:true});
  });
  el('menuUnlockForm').addEventListener('submit', event => {
    event.preventDefault();
    if(el('menuPin').value !== '1111') {
      el('menuPin').value = ''; el('menuPinError').hidden = false; el('menuPin').focus({preventScroll:true}); return;
    }
    el('menuPin').value = ''; el('menuPinError').hidden = true;
    unlock.close(); unlocked = true; sync(); menu.showModal();
    // Keep a held Enter key from activating the first menu action.
    el('boardMenuTitle').focus({preventScroll:true});
    timer = setTimeout(reset, 60000);
  });
  menu.addEventListener('close', () => { unlocked = false; clearTimeout(timer); });
  unlock.addEventListener('close', () => { el('menuPin').value = ''; });
  login.addEventListener('close', () => { loginAuthorized = false; el('password').value = ''; el('loginNotice').hidden = true; });
  for(const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => {
    el(button.dataset.closeDialog).close();
  });
  for(const dialog of dialogs) dialog.addEventListener('click', event => {
    if(event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  document.addEventListener('visibilitychange', () => { if(document.hidden) reset(); });
  el('menuLogin').addEventListener('click', () => {
    if(!consume('login')) return;
    loginAuthorized = true; clearNotice(); login.showModal(); el('name').focus({preventScroll:true});
  });
  const pageURL = () => new URL('.', location.href).href;
  function manualCopy() {
    el('shareAddress').value = pageURL(); share.showModal();
    el('shareAddress').focus({preventScroll:true}); el('shareAddress').select();
  }
  async function copyPage() {
    try { await navigator.clipboard.writeText(pageURL()); notify('Az oldal címét a vágólapra másoltam.'); }
    catch { manualCopy(); }
  }
  el('sharePage').addEventListener('click', async () => {
    if(!consume('share')) return;
    try {
      if(navigator.share) await navigator.share({title:document.title,url:pageURL()});
      else await copyPage();
    } catch(error) { if(error.name !== 'AbortError') await copyPage(); }
  });
  el('copyPage').addEventListener('click', () => { if(consume('copy')) copyPage(); });
  el('refreshWall').addEventListener('click', async () => {
    if(!consume('refresh')) return;
    clearNotice(); await poll(true);
  });
  sync();
})();
