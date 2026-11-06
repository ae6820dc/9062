import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('./menu.js',import.meta.url),'utf8');
class Element {
  constructor(id){this.id=id;this.open=false;this.hidden=false;this.value='';this.events={};this.dataset={};}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  async emit(name,event={}){for(const fn of this.events[name]||[])await fn({preventDefault(){},target:this,...event});}
  showModal(){this.open=true;}
  close(){this.open=false;for(const fn of this.events.close||[])fn();}
  focus(){doc.activeElement=this;}
  select(){this.selected=true;}
  getBoundingClientRect(){return {left:0,top:0,right:400,bottom:400};}
}
const ids=['menuUnlock','boardMenu','loginDialog','shareDialog','menuPin','password','menuPinError','menuSession','menuLogin','notifications','logout','refreshWall','boardMenuOpen','menuUnlockForm','boardMenuTitle','loginNotice','name','shareAddress','sharePage','copyPage'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const closeButtons=['menuUnlock','boardMenu','loginDialog','shareDialog'].map(id=>{const b=new Element('close-'+id);b.dataset.closeDialog=id;return b;});
const doc={hidden:false,title:'Baráti üzenőfal',events:{},getElementById:id=>elements[id],querySelectorAll:()=>closeButtons,addEventListener(name,fn){(this.events[name]??=[]).push(fn);}};
let shared=[],copied=[],idle;
const context={document:doc,window:{},token:'signed-in',currentName:'Teszt',URL,location:{href:'https://ae6820dc.github.io/9062/message/board/friends/?secret=ignored#setup=never-share'},navigator:{share:async data=>shared.push(data),clipboard:{writeText:async value=>copied.push(value)}},notify(){},clearNotice(){},poll:async()=>{},setTimeout:fn=>(idle=fn,1),clearTimeout(){}};
vm.runInNewContext(code,context);
const menu=context.window.boardMenu;
const unlock=async pin=>{await elements.boardMenuOpen.emit('click');elements.menuPin.value=pin;await elements.menuUnlockForm.emit('submit');};
assert.equal(menu.consume('notifications'),false);
await elements.menuLogin.emit('click');assert.equal(elements.loginDialog.open,false);
await elements.copyPage.emit('click');assert.equal(copied.length,0);
await unlock('0000');assert.equal(elements.boardMenu.open,false);assert.equal(elements.menuPinError.hidden,false);assert.equal(elements.menuPin.value,'');
await unlock('1111');assert.equal(elements.boardMenu.open,true);assert.equal(elements.menuPin.value,'');assert.equal(doc.activeElement.id,'boardMenuTitle');
assert.equal(menu.consume('notifications'),true);assert.equal(elements.boardMenu.open,false);assert.equal(menu.consume('notifications'),false);
await unlock('1111');elements.boardMenu.close();assert.equal(menu.consume('logout'),false);
await unlock('1111');idle();assert.equal(menu.consume('logout'),false);
await unlock('1111');doc.hidden=true;for(const fn of doc.events.visibilitychange)fn();assert.equal(elements.boardMenu.open,false);assert.equal(menu.consume('notifications'),false);doc.hidden=false;
context.token='';menu.sync();assert.equal(elements.menuLogin.hidden,false);assert.equal(elements.notifications.hidden,true);assert.equal(menu.allowLogin(),false);
await unlock('1111');await elements.menuLogin.emit('click');assert.equal(menu.allowLogin(),true);assert.equal(elements.loginDialog.open,true);elements.password.value='temporary';elements.loginDialog.close();assert.equal(menu.allowLogin(),false);assert.equal(elements.password.value,'');
await unlock('1111');await elements.sharePage.emit('click');assert.equal(shared.length,1);assert.equal(shared[0].url,'https://ae6820dc.github.io/9062/message/board/friends/');assert.ok(!shared[0].url.includes('secret'));
await unlock('1111');await elements.copyPage.emit('click');assert.equal(copied[0],shared[0].url);assert.equal(elements.boardMenu.open,false);
console.log('Passed: wrong PIN, locked actions, one-use unlock, close/timeout/background relock, protected login, credential clearing, safe share/copy URLs.');
