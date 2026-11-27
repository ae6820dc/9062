'use strict';
const GAME_FOLDER = 'Game';
const GAME_ID_LENGTH = 18;
const GAME_PREFIX_LENGTH = 1 + GAME_ID_LENGTH;
const GAME_DIGITS = '0123456789'.split('');
const PRIME_MAX_DEPTH = 65536;
const MAX_DEPTH = GAME_PREFIX_LENGTH + PRIME_MAX_DEPTH;
const DEFAULT_GAME_PATH = [GAME_FOLDER, ...Array(GAME_ID_LENGTH).fill('0')];
const NUMBER_FOLDER_COUNT = 256;

function buildNumberFolders() {
  const primes = [];
  for (let candidate = 2; primes.length < NUMBER_FOLDER_COUNT - 1; candidate++) {
    const isComposite = primes.some(divisor => divisor * divisor <= candidate && candidate % divisor === 0);
    if (!isComposite) primes.push(candidate);
  }
  return ['1', ...primes.map(String)];
}

const symbols = buildNumberFolders();
let path=[],history=[[]],cursor=0,listMode=false,currentFiles=[],folderOrder=[],database=null,ready=false,busy=false;
const $=id=>document.getElementById(id);
const playerFolders=['Player0','Player1','Player2','Player3'];
const resultFolders=['R0','R1','R2','R3'];
const isResult=name=>resultFolders.includes(name);
const explorerFolders = [...symbols, ...playerFolders, ...resultFolders];
function normalizePlayerFolder(name){return name.replace(/^player ?([0-3])$/i,'Player$1');}
const explorerFolderSet=new Set(explorerFolders);
function validPath(parts) {
  return Array.isArray(parts) && parts.length <= MAX_DEPTH &&
    parts.every((name, index) => {
      if (index === 0) return name === GAME_FOLDER;
      if (index < GAME_PREFIX_LENGTH) return GAME_DIGITS.includes(name);
      return explorerFolderSet.has(name) && (!isResult(name) || index === parts.length - 1);
    });
}
function normalizeFolderName(name) {
  if (name.toLowerCase() === 'game') return GAME_FOLDER;
  if (/^r[0-3]$/i.test(name)) return name.toUpperCase();
  return normalizePlayerFolder(name);
}
function hasSubfolders(parts) {
  return parts.length < MAX_DEPTH && !isResult(parts.at(-1));
}
function foldersAt(parts) {
  if (!hasSubfolders(parts)) return [];
  if (parts.length === 0) return [GAME_FOLDER];
  return parts.length < GAME_PREFIX_LENGTH ? GAME_DIGITS : explorerFolders;
}
function pathKey(p=path){return '/'+p.join('/');}
function orderKey(depth) {
  return depth < GAME_PREFIX_LENGTH ? 'folderOrder:digits' : 'folderOrder:explorer';
}
function readFolderOrder(settings, parts, onOrder) {
  if (parts.length === 0 || !hasSubfolders(parts)) {
    onOrder([]);
    return;
  }
  const request = settings.get(orderKey(parts.length));
  request.onsuccess = () => onOrder(request.result?.names);
}
function validName(name){return typeof name==='string'&&name.trim().length>0&&Array.from(name).length<=255&&!name.includes('/')&&!name.includes(String.fromCharCode(92))&&!Array.from(name).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&name!=='.'&&name!=='..';}

const DATABASE_NAME = document.querySelector('.window').dataset.storageKey;
function databaseTask(stores,mode,operation){return new Promise((resolve,reject)=>{let tx,result;try{tx=database.transaction(stores,mode);tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||new Error('Storage operation cancelled.'));tx.onerror=()=>{};operation(tx,value=>{result=value;});}catch(error){if(tx)try{tx.abort();}catch(e){}reject(error);}});}
function storedFile(folder,file){return {folder,name:file.name,nameFold:file.name.toLocaleLowerCase('en-US'),created:file.created||Date.now()};}
function readFolder(folder){return databaseTask(['files'],'readonly',(tx,result)=>{const r=tx.objectStore('files').index('folder').getAll(folder);r.onsuccess=()=>result(r.result);});}
function readSetting(key){return databaseTask(['settings'],'readonly',(tx,result)=>{const r=tx.objectStore('settings').get(key);r.onsuccess=()=>result(r.result);});}
function locationTask(next,mode){
  return databaseTask(['files','settings'],'readwrite',(tx,result)=>{
    const settings=tx.objectStore('settings'),location={};
    settings.put({key:'state',path:[...next],listMode:mode});
    readFolderOrder(settings,next,names=>{location.order=names;});
    const files=tx.objectStore('files').index('folder').getAll(pathKey(next));
    files.onsuccess=()=>{location.files=files.result;};
    result(location);
  });
}
function setLocationEntries(files,order){
  currentFiles=files;
  folderOrder=Array.isArray(order)?order:[];
}
function setBusy(value){busy=value;document.querySelector('.window').inert=!ready||value;for(const form of [$('fileForm'),$('actionForm')])for(const button of form.querySelectorAll('button'))button.disabled=value;}
function storageProblem(error){if(error&&error.name==='ConstraintError')return 'A file with this name already exists here.';if(error&&error.name==='QuotaExceededError')return 'Device storage is full. No changes were saved.';return 'Could not access saved data. No changes were saved. Please try again.';}
async function runTask(operation,errorElement){if(!ready||busy)return;setBusy(true);try{await operation();}catch(error){const message=storageProblem(error);if(errorElement)errorElement.textContent=message;else toast(message);}finally{setBusy(false);}}
function notice(message,retry=false){$('storageNotice').hidden=false;$('storageMessage').textContent=message;$('retryStorage').hidden=!retry;document.querySelector('.window').inert=true;}
function migrateToGames(transaction) {
  const gamePath = parts => [...DEFAULT_GAME_PATH, ...parts.filter(name => name !== '_')];
  const settings = transaction.objectStore('settings');
  const savedState = settings.get('state');
  savedState.onsuccess = () => {
    const state = savedState.result;
    if (state?.path?.length) {
      settings.put({ ...state, path: gamePath(state.path) });
    }
  };

  const files = transaction.objectStore('files');
  const byName = files.index('uniqueName');
  const request = files.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const original = cursor.value;
    const parts = original.folder === '/' ? [] : original.folder.slice(1).split('/');
    // The cursor can encounter the new key after the file has moved.
    if (parts[0] === GAME_FOLDER) {
      cursor.continue();
      return;
    }

    const destination = gamePath(parts);
    const folder = pathKey(destination);
    const originalCharacters = Array.from(original.name);
    function moveFile(number) {
      const suffix = number === 1 ? '' : ' (' + number + ')';
      const name = originalCharacters.slice(0, 255 - suffix.length).join('') + suffix;
      if (foldersAt(destination).includes(normalizeFolderName(name))) {
        moveFile(number + 1);
        return;
      }
      const moved = storedFile(folder, { ...original, name });
      const existing = byName.getKey([folder, moved.nameFold]);
      existing.onsuccess = () => {
        if (existing.result !== undefined) {
          moveFile(number + 1);
          return;
        }
        files.add(moved);
        cursor.delete();
        cursor.continue();
      };
    }
    moveFile(1);
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Saved games are unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 3);
    request.onupgradeneeded = event => {
      if (event.oldVersion > 0) {
        migrateToGames(request.transaction);
        return;
      }
      const db = request.result;
      const files = db.createObjectStore('files', { keyPath: ['folder', 'name'] });
      files.createIndex('folder', 'folder');
      files.createIndex('uniqueName', ['folder', 'nameFold'], { unique: true });
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => notice('Close other Explorer tabs, then reload to open your saved game.', true);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        ready = false;
        notice('This game was updated in another tab. Reload to continue.', true);
      };
      resolve(db);
    };
  });
}
async function initialize(){notice('Opening saved game…');try{database=await openDatabase();const state=await readSetting('state');path=state&&validPath(state.path)?[...state.path]:[];listMode=!!(state&&state.listMode);history=[[...path]];cursor=0;const [files,order]=await Promise.all([readFolder(pathKey()),databaseTask(['settings'],'readonly',(tx,result)=>readFolderOrder(tx.objectStore('settings'),path,result))]);setLocationEntries(files,order);ready=true;setBusy(false);$('storageNotice').hidden=true;render();}catch(error){ready=false;if(database)database.close();notice('Could not open your saved game. Close other Explorer tabs and reload to try again.',true);}}
let toastTimer;
function toast(s){$('toast').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',3500);}

function navigate(next){if(!validPath(next)||!ready||busy)return;if(next.join('/')===path.join('/')){$('address').value=pathKey();return;}return runTask(async()=>{const {files,order}=await locationTask(next,listMode);path=[...next];setLocationEntries(files,order);history=history.slice(0,cursor+1);history.push([...path]);cursor=history.length-1;render();});}
function enter(symbol){if(isResult(path.at(-1)))return;if(path.length===MAX_DEPTH){toast('You reached the 65536-level limit after the game ID.');return;}return navigate([...path,symbol]);}
function goBack(){if(cursor>0)return runTask(async()=>{const next=history[cursor-1],{files,order}=await locationTask(next,listMode);cursor--;path=[...next];setLocationEntries(files,order);render();});}
function goForward(){if(cursor<history.length-1)return runTask(async()=>{const next=history[cursor+1],{files,order}=await locationTask(next,listMode);cursor++;path=[...next];setLocationEntries(files,order);render();});}
function up() {
  if (path.length === 0) return;
  return navigate(path.length > GAME_PREFIX_LENGTH ? path.slice(0, GAME_PREFIX_LENGTH) : []);
}
const folderGrid=$('folders');
function applyFolderOrder(names) {
  const elements = Array.from(folderGrid.querySelectorAll('.folder[draggable="true"]'));
  const byName = new Map(elements.map(element => [element.dataset.symbol, element]));
  const savedOrder = new Set(names);
  const ordered = [
    ...names.map(name => byName.get(name)).filter(Boolean),
    ...elements.filter(element => !savedOrder.has(element.dataset.symbol))
  ];
  const firstFile = folderGrid.querySelector('.file');
  for (const element of ordered) folderGrid.insertBefore(element, firstFile);
}
let draggedFolder=null,dropTarget=null;

function markDropTarget(target,side){
  if(dropTarget!==target)dropTarget?.removeAttribute('data-drop-side');
  dropTarget=target;
  if(target)target.dataset.dropSide=side;
}

function clearFolderDrag(){
  draggedFolder?.classList.remove('is-dragging');
  draggedFolder=null;
  markDropTarget(null);
}

function dropSide(event,target){
  const bounds=target.getBoundingClientRect();
  const after=listMode
    ? event.clientY>=bounds.top+bounds.height/2
    : event.clientX>=bounds.left+bounds.width/2;
  return after?'after':'before';
}

function folderDropTarget(event){
  const target=event.target.closest('.folder[draggable="true"]');
  return !busy&&draggedFolder&&folderGrid.contains(draggedFolder)&&target!==draggedFolder
    ? target
    : null;
}

folderGrid.addEventListener('dragstart',event=>{
  const folder=event.target.closest('.folder[draggable="true"]');
  if(!folder||busy)return;
  draggedFolder=folder;
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',folder.dataset.symbol);
  folder.classList.add('is-dragging');
});
folderGrid.addEventListener('dragover',event=>{
  const target=folderDropTarget(event);
  if(!target){markDropTarget(null);return;}
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
  markDropTarget(target,dropSide(event,target));
});
folderGrid.addEventListener('dragleave',event=>{
  if(dropTarget&&!dropTarget.contains(event.relatedTarget))markDropTarget(null);
});
folderGrid.addEventListener('dragend',clearFolderDrag);
folderGrid.addEventListener('drop',event=>{
  const target=folderDropTarget(event);
  if(!target)return;
  event.preventDefault();
  const source=draggedFolder;
  const after=dropSide(event,target)==='after';
  clearFolderDrag();

  const folders=Array.from(folderGrid.querySelectorAll('.folder[draggable="true"]'));
  const reordered=folders.filter(folder=>folder!==source);
  reordered.splice(reordered.indexOf(target)+Number(after),0,source);
  if(reordered.every((folder,index)=>folder===folders[index]))return;

  const names=reordered.map(folder=>folder.dataset.symbol),key=orderKey(path.length);
  return runTask(async()=>{
    await databaseTask(['settings'],'readwrite',tx=>{
      tx.objectStore('settings').put({key,names});
    });
    folderOrder=names;
    applyFolderOrder(folderOrder);
    $('announcement').textContent=source.dataset.symbol+' moved. Order updated at matching levels.';
  });
});




function depthCounters(depth) {
  return [
    Math.min(depth, 1),
    Math.min(GAME_ID_LENGTH, Math.max(0, depth - 1)),
    Math.max(0, depth - GAME_PREFIX_LENGTH)
  ];
}

function render(){
clearFolderDrag();
const depth = path.length;
const current = path.at(-1);
const atResult = isResult(current);
const atEnd = !hasSubfolders(path);
const folderNames = foldersAt(path);
const [gameDepth, idDepth, primeDepth] = depthCounters(depth);
const nextFolderCount = depth + 1 < GAME_PREFIX_LENGTH ? GAME_DIGITS.length : explorerFolders.length;
const folderCount = folderNames.length;
$('depth').textContent = gameDepth;
$('idDepth').textContent = idDepth;
$('gameDepth').textContent = primeDepth;
$('heading').textContent = depth ? 'Folder: ' + current : 'Prime Drive';
const atMaximumDepth = depth === MAX_DEPTH && !atResult;
$('subtitle').textContent = atMaximumDepth ? 'You reached the maximum depth. Create a file or explore another branch.' : '';
$('subtitle').hidden = !atMaximumDepth;
$('address').value = pathKey();
$('back').disabled = cursor === 0;
$('forward').disabled = cursor === history.length - 1;
$('up').disabled = depth === 0;
$('home').disabled = depth === 0;
$('progress').style.width = (primeDepth / PRIME_MAX_DEPTH * 100) + '%';
document.querySelector('[role=progressbar]').setAttribute('aria-valuenow', primeDepth);
$('count').textContent = folderCount+' folders · '+currentFiles.length+' '+(currentFiles.length===1?'file':'files');
$('levelLabel').textContent = atResult ? 'Result' : atEnd ? 'Maximum depth' : 'Next: level ' + (depth + 1);
$('status').textContent = (folderCount+currentFiles.length)+' items · Level '+depth;
$('announcement').textContent = 'Level '+depth+'. '+$('count').textContent+'.';
const folders=$('folders');folders.replaceChildren();folders.hidden=atEnd&&!currentFiles.length;$('terminal').hidden=!atEnd;
$('terminalHeading').textContent=atResult?'Result '+path.at(-1):'You reached level 65536!';
for (const symbol of folderNames) {
  const button = document.createElement('button');
  button.className = 'folder';
  button.dataset.symbol = symbol;
  button.draggable = depth > 0;
  button.setAttribute('aria-label', 'Open ' + symbol + ' folder, level ' + (depth + 1));
  button.innerHTML = '<svg aria-hidden="true"><use href="#folder-icon"/></svg><span class="folder-name"></span><span class="folder-info"></span>';
  button.querySelector('.folder-name').textContent = symbol;
  button.querySelector('.folder-info').textContent = isResult(symbol) ? 'Result · no subfolders' :
    depth === MAX_DEPTH - 1 ? 'Level 65536 · final level' :
    nextFolderCount + ' subfolders';
  button.onclick = () => enter(symbol);
  folders.append(button);
}
currentFiles.forEach(file=>{const b=document.createElement('button');b.className='folder file';b.setAttribute('aria-label','File: '+file.name);b.title=file.name;b.innerHTML='<svg aria-hidden="true"><use href="#file-icon"/></svg><span class="folder-name"></span><span class="folder-info">File · name only</span>';b.querySelector('.folder-name').textContent=file.name;b.onclick=()=>toast(file.name+' — a virtual file, stored in this folder.');folders.append(b);});

applyFolderOrder(folderOrder);folders.classList.toggle('list',listMode);$('gridView').setAttribute('aria-pressed',String(!listMode));$('listView').setAttribute('aria-pressed',String(listMode));
}
$('back').onclick=goBack;$('forward').onclick=goForward;$('up').onclick=$('terminalUp').onclick=up;$('home').onclick=$('root').onclick=()=>navigate([]);
function changeView(mode){return runTask(async()=>{const {files,order}=await locationTask(path,mode);setLocationEntries(files,order);listMode=mode;render();});}
$('gridView').onclick=()=>changeView(false);$('listView').onclick=()=>changeView(true);
$('addressForm').onsubmit = event => {
  event.preventDefault();
  const value = $('address').value.trim().replace(/^\/+|\/+$/g, '');
  const next = value ? value.split('/').map(normalizeFolderName) : [];
  if (!validPath(next)) {
    toast('Start with /Game and 18 digits (0–9), then use prime folders, 1, or Player0–Player3. R0–R3 end the path.');
    return;
  }
  navigate(next);
  $('address').blur();
};
$('copy').onclick=async()=>{const text=pathKey();try{await navigator.clipboard.writeText(text);toast('Path copied.');}catch(e){$('address').focus();$('address').select();try{if(!document.execCommand('copy'))throw Error();toast('Path copied.');}catch(e){toast('Path selected. You can copy it manually.');}}};
$('newFile').onclick=()=>{$('fileName').value='';$('fileError').textContent='';$('fileLocation').textContent='Location: '+pathKey();$('fileDialog').showModal();$('fileName').focus();};
$('cancelFile').onclick=()=>$('fileDialog').close();

$('fileForm').onsubmit=e=>{e.preventDefault();if(busy||!ready)return;const name=$('fileName').value.trim().normalize('NFC'),folder=pathKey();
if(!validName(name)){$('fileError').textContent='Enter 1–255 characters, without slashes or control characters.';return;}
const hasFolderWithName = foldersAt(path).includes(normalizeFolderName(name));
if (hasFolderWithName || currentFiles.some(file => file.name.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'))) {
  $('fileError').textContent = 'A file or folder with this name already exists here.';
  return;
}
return runTask(async()=>{const entries=await databaseTask(['files'],'readwrite',(tx,result)=>{const store=tx.objectStore('files');store.add(storedFile(folder,{name,created:Date.now()}));const r=store.index('folder').getAll(folder);r.onsuccess=()=>result(r.result);});currentFiles=entries;$('fileDialog').close();render();toast('Created '+name);},$('fileError'));};
document.addEventListener('keydown',e=>{if(!ready||busy||$('fileDialog').open||$('actionDialog').open||!$('appMenu').hidden||e.target.closest('input,textarea,select,[contenteditable=true]'))return;if(e.altKey){if(e.key==='ArrowLeft'){e.preventDefault();goBack();}if(e.key==='ArrowRight'){e.preventDefault();goForward();}if(e.key==='ArrowUp'){e.preventDefault();up();}return;}if(e.ctrlKey||e.metaKey)return;if(e.key==='Backspace'){e.preventDefault();up();return;}
if (e.repeat) return;
if (path.length === 0 && e.key.toLowerCase() === 'g') {
  e.preventDefault();
  enter(GAME_FOLDER);
} else if (GAME_DIGITS.includes(e.key) && foldersAt(path).includes(e.key)) {
  e.preventDefault();
  enter(e.key);
}
});
const WEBSITE_URL = 'https://ae6820dc.github.io/9062/explorer/18/1/sample1.html';
let actionMode='',actionKey='',actionFiles=[];
const menuItems=Array.from($('appMenu').querySelectorAll('[role=menuitem]'));
function closeMenu(focus=false){$('appMenu').hidden=true;$('menuButton').setAttribute('aria-expanded','false');if(focus)$('menuButton').focus();}
function openMenu(focusFirst=false){$('appMenu').hidden=false;$('menuButton').setAttribute('aria-expanded','true');if(focusFirst)menuItems[0].focus();}
$('menuButton').onclick=()=>{$('appMenu').hidden?openMenu(true):closeMenu(true);};
$('menuButton').onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openMenu();menuItems[e.key==='ArrowUp'?menuItems.length-1:0].focus();}};
$('appMenu').onkeydown=e=>{const current=menuItems.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();closeMenu(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?menuItems.length-1:(current+(e.key==='ArrowDown'?1:-1)+menuItems.length)%menuItems.length;menuItems[next].focus();}};
document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap'))closeMenu();});
document.addEventListener('focusin',e=>{if(!e.target.closest('.menu-wrap'))closeMenu();});
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => { installPrompt = undefined; });

async function installApp() {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    closeMenu(true);
    toast('Prime Explorer is already open as an installed app.');
    return;
  }

  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    closeMenu(true);
    try {
      await prompt.prompt();
      return;
    } catch {
      // The browser menu remains available if the prompt expires.
    }
  }

  showAction('install');
}

function actionParagraph(text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;$('actionContent').append(p);return p;}
function showAction(mode){
closeMenu();actionMode=mode;actionKey=pathKey();actionFiles=[...currentFiles];
$('actionContent').replaceChildren();$('actionError').textContent='';$('actionPassword').value='';$('passwordArea').hidden=!['new','delete'].includes(mode);$('confirmAction').hidden=false;$('confirmAction').disabled=false;$('confirmAction').className='primary';$('cancelAction').textContent='Cancel';
if(mode==='new'){$('actionTitle').textContent='New game';actionParagraph('Start again from the root folder? This removes every file you created in every folder on this device.');actionParagraph('Enter the password to start a new game.');$('confirmAction').textContent='Start new game';$('confirmAction').classList.add('danger');}
if(mode==='delete'){$('actionTitle').textContent='Delete files';actionParagraph('Choose the files to delete from this folder. Files in other folders will stay.');actionParagraph('Location: '+actionKey,'action-location');
if(!actionFiles.length){actionParagraph('There are no files in this folder.');$('passwordArea').hidden=true;$('confirmAction').hidden=true;$('cancelAction').textContent='Close';}
else{const list=document.createElement('div');list.className='delete-list';const allLabel=document.createElement('label');allLabel.className='delete-choice delete-all';const all=document.createElement('input');all.type='checkbox';all.id='selectAllFiles';const allText=document.createElement('span');allText.textContent='Select all';allLabel.append(all,allText);list.append(allLabel);
actionFiles.forEach((file,index)=>{const label=document.createElement('label');label.className='delete-choice';const box=document.createElement('input');box.type='checkbox';box.value=String(index);box.className='delete-check';const text=document.createElement('span');text.textContent=file.name;label.append(box,text);list.append(label);});$('actionContent').append(list);
all.onchange=()=>{for(const box of list.querySelectorAll('.delete-check'))box.checked=all.checked;updateDeleteButton();};list.onchange=()=>{const boxes=Array.from(list.querySelectorAll('.delete-check')),selected=boxes.filter(b=>b.checked).length;all.checked=selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;updateDeleteButton();};$('confirmAction').classList.add('danger');updateDeleteButton();}}
if(mode==='about'){$('actionTitle').textContent='About';actionParagraph('Prime Explorer');actionParagraph('Open Game, then choose 18 digits (0–9) for the game ID. Each branching level after the ID offers 1 and the first 255 primes.');actionParagraph('Player0–Player3 are available alongside R0–R3. A result ends the branch and can contain virtual files. Dragging a folder changes the order at matching levels.');actionParagraph('Your position and files are saved in this browser on this device. Files contain names only; they do not run programs.');actionParagraph('Program ID: '+$('programId').textContent,'about-details');$('confirmAction').hidden=true;$('cancelAction').textContent='Close';}
if(mode==='share'){$('actionTitle').textContent='Share website';actionParagraph('Copy this link to share the program website. Your files and saved game are not included.');const label=document.createElement('label');label.htmlFor='shareWebsiteUrl';label.textContent='Website';const input=document.createElement('input');input.id='shareWebsiteUrl';input.className='share-url';input.type='url';input.readOnly=true;input.value=WEBSITE_URL;$('actionContent').append(label,input);$('confirmAction').textContent='Copy link';}
if (mode === 'install') {
  $('actionTitle').textContent = 'Install Prime Explorer';
  actionParagraph('Android Chrome: open the ⋮ menu and choose Install app or Add to Home screen.');
  actionParagraph('iPhone and iPad: open Share and choose Add to Home Screen.');
  actionParagraph('Desktop Chrome or Edge: use the install icon in the address bar or the browser menu.');
  $('confirmAction').hidden = true;
  $('cancelAction').textContent = 'Close';
}
$('actionDialog').showModal();if(mode==='new')$('actionPassword').focus();else if(mode==='share'){$('shareWebsiteUrl').focus();$('shareWebsiteUrl').select();}else $('cancelAction').focus();
}
function updateDeleteButton(){const count=$('actionContent').querySelectorAll('.delete-check:checked').length;$('confirmAction').textContent=count?'Delete '+count+' '+(count===1?'file':'files'):'Delete files';$('confirmAction').disabled=count===0;}
async function shareWebsite(){closeMenu();if(navigator.share){try{await navigator.share({title:'Prime Explorer',url:WEBSITE_URL});return;}catch(e){if(e.name==='AbortError')return;}}showAction('share');}
async function exportHtml(){
  closeMenu(true);
  if(!ready||busy)return;
  const timestamp=Date.now();
  const currentPath=pathKey();
  const depth=path.length;
  const programId=$('programId').textContent;
  const entities={'&':'&amp;','<':'&lt;','>':'&gt;'};
  const escapeText=value=>value.replace(/[&<>]/g,character=>entities[character]);
  const formatPath=value=>escapeText(value).replaceAll('/','/<wbr>');
  try{
    const files=await databaseTask(['files'],'readonly',(tx,result)=>{
      const request=tx.objectStore('files').getAll();
      request.onsuccess=()=>result(request.result);
    });
    const fileCount=`Saved virtual files (${files.length})`;
    const savedFiles=files.length
      ? `<details>
<summary>${fileCount}</summary>
<table><thead><tr><th scope="col">Folder path</th><th scope="col">File name</th></tr></thead><tbody>${files.map(file=>
          `<tr><td><code>${formatPath(file.folder)}</code></td><td>${escapeText(file.name)}</td></tr>`
        ).join('')}</tbody></table>
</details>`
      : `<p class="file-count">${fileCount}</p>`;
    const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prime Explorer · Export</title>
<style>
body{font:1rem/1.5 system-ui,sans-serif;max-width:70rem;margin:2rem auto;padding:0 1rem;color:#253448}
dt{font-weight:600}dd{margin:0 0 .75rem;overflow-wrap:anywhere}
summary,.file-count{margin:0;padding:.5rem .75rem;border:1px solid #d5dce6;border-radius:.5rem;background:#edf2fb;font-weight:600}
summary{cursor:pointer}
summary:focus-visible{outline:2px solid #285fe5;outline-offset:2px}
table{margin-top:.5rem;border-collapse:collapse;width:100%;table-layout:fixed}
th,td{border:1px solid #d5dce6;padding:.5rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}
td{white-space:pre-wrap}th{background:#edf2fb}
</style>
</head>
<body>
<h1>Prime Explorer · Export</h1>
<dl>
<dt>Program ID</dt><dd><code>${escapeText(programId)}</code></dd>
<dt>Unix time (ms)</dt><dd><code>${timestamp}</code></dd>
<dt>Exported at (UTC)</dt><dd>${new Date(timestamp).toISOString()}</dd>
<dt>Current path</dt><dd><code>${formatPath(currentPath)}</code></dd>
<dt>Depth</dt><dd>${[...depthCounters(depth), PRIME_MAX_DEPTH].join(' / ')}</dd>
</dl>
${savedFiles}
</body>
</html>`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;
    link.download=`Prime-Explorer-${programId}-${timestamp}.html`;
    link.hidden=true;
    document.body.append(link);
    try{link.click();}
    finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
  }catch(error){
    toast('Could not export saved files. Please try again.');
  }
}
for (const item of menuItems) {
  item.onclick = () => {
    switch (item.dataset.action) {
      case 'share': return shareWebsite();
      case 'export': return exportHtml();
      case 'install': return installApp();
      case 'samples': return location.assign('readme.html');
      default: return showAction(item.dataset.action);
    }
  };
}
$('cancelAction').onclick=()=>$('actionDialog').close();
$('actionDialog').addEventListener('close',()=>{$('actionPassword').value='';$('menuButton').focus();});
$('actionForm').onsubmit=async e=>{e.preventDefault();if(busy||!ready)return;
if(actionMode==='share'){try{await navigator.clipboard.writeText(WEBSITE_URL);$('actionDialog').close();toast('Website link copied.');}catch(e){$('shareWebsiteUrl').focus();$('shareWebsiteUrl').select();try{if(!document.execCommand('copy'))throw Error();$('actionDialog').close();toast('Website link copied.');}catch(e){$('actionError').textContent='Link selected. Copy it manually.';}}return;}
if(!['new','delete'].includes(actionMode))return;
if($('actionPassword').value!=='1111'){$('actionError').textContent='Incorrect password. Please try again.';$('actionPassword').value='';$('actionPassword').focus();return;}

if(actionMode==='new'){return runTask(async()=>{await databaseTask(['files','settings'],'readwrite',tx=>{tx.objectStore('files').clear();tx.objectStore('settings').put({key:'state',path:[],listMode:false});});path=[];history=[[]];cursor=0;listMode=false;setLocationEntries([],[]);$('actionDialog').close();render();toast('New game started.');},$('actionError'));}
else{const selected=Array.from($('actionContent').querySelectorAll('.delete-check:checked'),box=>actionFiles[Number(box.value)]?.name);if(!selected.length){$('actionError').textContent='Select at least one file.';return;}return runTask(async()=>{const entries=await databaseTask(['files'],'readwrite',(tx,result)=>{const store=tx.objectStore('files');for(const name of selected)store.delete([actionKey,name]);const r=store.index('folder').getAll(actionKey);r.onsuccess=()=>result(r.result);});currentFiles=entries;$('actionDialog').close();render();toast(selected.length===1?'File deleted.':selected.length+' files deleted.');},$('actionError'));}

};

$('retryStorage').onclick=()=>location.reload();
initialize();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Prime Explorer offline setup failed.', error);
  });
}
