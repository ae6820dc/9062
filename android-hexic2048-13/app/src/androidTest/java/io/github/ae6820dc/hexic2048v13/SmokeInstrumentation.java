package io.github.ae6820dc.hexic2048v13;
import android.app.*;
import android.os.*;
import android.content.Intent;
import android.view.MotionEvent;
import java.util.concurrent.*;
public class SmokeInstrumentation extends Instrumentation {
 MainActivity a;
 String mode;
 @Override public void onCreate(Bundle b){super.onCreate(b);mode=b.getString("mode","");start();}
 String js(String s) throws Exception {
  ArrayBlockingQueue<String> q=new ArrayBlockingQueue<>(1);
  runOnMainSync(()->a.web.evaluateJavascript(s,q::add));
  String v=q.poll(10,TimeUnit.SECONDS);if(v==null)throw new AssertionError("JS timeout");return v;
 }
 void require(boolean b,String m){if(!b)throw new AssertionError(m);}
 void waitReady() throws Exception {
  for(int n=0;n<100;n++){if("true".equals(js("document.readyState==='complete' && document.querySelectorAll('#board .tw').length>0")))return;Thread.sleep(100);}
  throw new AssertionError("Page failed to render");
 }
 void pick(String button,int index) throws Exception {js("document.getElementById('"+button+"').click();document.querySelectorAll('#mm>div')["+index+"].click()");Thread.sleep(50);}
 void swipeUp() throws Exception {
  int[] p=new int[2];int[] width=new int[1];
  runOnMainSync(()->{a.web.getLocationOnScreen(p);width[0]=a.web.getWidth();});
  org.json.JSONArray rect=new org.json.JSONArray(js("(()=>{const r=document.getElementById('board').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()"));
  float scale=width[0]/(float)rect.getDouble(2);
  float x=p[0]+(float)rect.getDouble(0)*scale;
  float cy=p[1]+(float)rect.getDouble(1)*scale;
  long t=SystemClock.uptimeMillis();
  MotionEvent down=MotionEvent.obtain(t,t,MotionEvent.ACTION_DOWN,x,cy+40*scale,0);down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);sendPointerSync(down);down.recycle();
  for(int i=1;i<=10;i++){Thread.sleep(20);MotionEvent m=MotionEvent.obtain(t,SystemClock.uptimeMillis(),MotionEvent.ACTION_MOVE,x,cy+(40-i*8)*scale,0);m.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);sendPointerSync(m);m.recycle();}
  Thread.sleep(20);
  MotionEvent up=MotionEvent.obtain(t,SystemClock.uptimeMillis(),MotionEvent.ACTION_UP,x,cy-40*scale,0);up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);sendPointerSync(up);up.recycle();
  Thread.sleep(1000);
 }
 @Override public void onStart(){
  Bundle result=new Bundle();
  try{
   a=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
   waitReady();
   if("seed".equals(mode)){
    pick("bAuto",0);Thread.sleep(2400);
    js("if(document.getElementById('bAuto').classList.contains('on'))document.getElementById('bAuto').click()");
    Thread.sleep(800);
    js("window.alert=()=>{};document.querySelector('#hm [data-a=save]').click();localStorage.setItem('upgrade_test_expected',localStorage.getItem('hex2048_manual_save_data_A442803514634F8E'));localStorage.setItem('upgrade_test_score',document.getElementById('score').textContent)");
    require("true".equals(js("localStorage.getItem('upgrade_test_expected')!==null")),"Manual save exists");
    runOnMainSync(()->a.finish());waitForIdleSync();Thread.sleep(2500);
    result.putString("stream","SEEDED saved progress for update test\n");finish(Activity.RESULT_OK,result);return;
   }
   require("Hexic 2048".contentEquals(getTargetContext().getApplicationInfo().loadLabel(getTargetContext().getPackageManager())),"App label");
   require("true".equals(js("getComputedStyle(document.body).backgroundColor==='rgb(250, 248, 239)' && document.documentElement.dataset.theme==='light'")),"Original light theme in dark system mode");
   if("upgrade".equals(mode)){
    require("true".equals(js("localStorage.getItem('upgrade_test_expected')===localStorage.getItem('hex2048_manual_save_data_A442803514634F8E') && localStorage.getItem('upgrade_test_expected')!==null")),"Upgrade preserved full save");
    require("true".equals(js("document.getElementById('score').textContent===localStorage.getItem('upgrade_test_score')")),"Upgrade restored score");
    result.putString("stream","PASS: Android 16 offline launch, original light theme with dark system setting, app name Hexic 2048, complete save and score preserved through APK update.\n");finish(Activity.RESULT_OK,result);return;
   }
   if("stop_save".equals(mode)){
    js("localStorage.clear();localStorage.setItem('hex2048_manual_save_data_A442803514634F8E',JSON.stringify({mi:13,gmode:'classic',score:'0n',undos:10,uid:2,started:true,tiles:[{id:1,v:'1n',q:0,r:0},{id:2,v:'1n',q:0,r:1}],hist:[],bestScores:{}}));location.reload()");
    Thread.sleep(1000);waitReady();
    pick("bAuto",3);
    js("document.getElementById('bAuto').click()");
    require("true".equals(js("(()=>{const s=JSON.parse(localStorage.getItem('hex2048_manual_save_data_A442803514634F8E'));return s.moveCount===1 && s.auto.running===false && s.score.slice(0,-1)===document.getElementById('score').textContent})()")),"Stop during first move saved final board");
    js("localStorage.setItem('stop_expected',localStorage.getItem('hex2048_manual_save_data_A442803514634F8E'))");
    Thread.sleep(1200);
    require("true".equals(js("localStorage.getItem('stop_expected')===localStorage.getItem('hex2048_manual_save_data_A442803514634F8E') && !document.getElementById('bAuto').classList.contains('on')")),"Stopped game stays saved");
    js("location.reload()");Thread.sleep(1000);waitReady();
    require("true".equals(js("(()=>{const s=JSON.parse(localStorage.getItem('stop_expected'));return document.querySelectorAll('#board .tw').length===s.tiles.length && document.getElementById('score').textContent===s.score.slice(0,-1) && !document.getElementById('bAuto').classList.contains('on')})()")),"Reopen restored stopped board");
    pick("bAuto",3);
    runOnMainSync(()->a.finish());waitForIdleSync();Thread.sleep(1500);
    a=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    waitReady();
    require("true".equals(js("(()=>{const s=JSON.parse(localStorage.getItem('hex2048_manual_save_data_A442803514634F8E'));return s.moveCount===2 && !s.auto.running && !document.getElementById('bAuto').classList.contains('on') && document.querySelectorAll('#board .tw').length===s.tiles.length && document.getElementById('score').textContent===s.score.slice(0,-1)})()")),"Native pause flushed second move and restored it");
    result.putString("stream","PASS: stop during animation saves complete move below 100, Auto remains stopped, reload restores board and score, native pause saves remaining move.\\n");finish(Activity.RESULT_OK,result);return;
   }
   require(js("document.getElementById('hint').textContent").contains("27A5431D1655F0FE7E95D6DBDC19A328"),"Program ID");
   int[] counts={7,19,37,61,91,127,169,16,25,36,49,64,81,100};
   for(int i=0;i<counts.length;i++){pick("bGrid",i);require(Integer.toString(counts[i]).equals(js("document.querySelectorAll('#board .cw').length")),"Grid "+i);}
   pick("bGrid",0);pick("bMode",1);
   require("\"flex\"".equals(js("document.getElementById('startTxt').style.display")),"Survival start");
   js("document.getElementById('startTxt').click()");Thread.sleep(1100);
   require("true".equals(js("document.querySelectorAll('#board .tw').length>2")),"Survival timer");
   pick("bMode",2);
   require("true".equals(js("document.querySelectorAll('#board .tw').length>2")),"X tile mode");
   js("localStorage.clear();localStorage.setItem('hex2048_manual_save_data_A442803514634F8E',JSON.stringify({mi:0,gmode:'classic',score:'0n',undos:10,uid:2,started:true,tiles:[{id:1,v:'1n',q:0,r:0},{id:2,v:'1n',q:0,r:1}],hist:[],bestScores:{}}));location.reload()");
   Thread.sleep(1000);waitReady();
   js("window.testEvents=[];['pointerdown','pointerup','pointercancel'].forEach(k=>window.addEventListener(k,e=>testEvents.push([k,e.clientX,e.clientY,e.target.id])))");
   swipeUp();
   require("\"2\"".equals(js("document.getElementById('score').textContent")),"Native swipe and merge; observed="+js("JSON.stringify({score:document.getElementById(\'score\').textContent,events:window.testEvents,saved:localStorage.getItem(\'hex2048_manual_save_data_A442803514634F8E\')})"));
   js("document.getElementById('bUndo').click()");
   require("\"0\"".equals(js("document.getElementById('score').textContent")),"Undo score");
   require("\"9\"".equals(js("document.getElementById('badge').textContent")),"Undo count");
   js("window.alert=()=>{};document.querySelector('#hm [data-a=save]').click()");
   runOnMainSync(()->a.finish());waitForIdleSync();
   a=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitReady();
   require("\"9\"".equals(js("document.getElementById('badge').textContent")),"Saved state on reopen");
   pick("bAuto",0);Thread.sleep(1600);
   js("if(document.getElementById('bAuto').classList.contains('on'))document.getElementById('bAuto').click()");
   require("true".equals(js("!document.getElementById('bUndo').disabled")),"Auto mode made moves");
   result.putString("stream","PASS: Android 16 offline launch, original light theme, app name, saved progress through APK update, Program ID, all 14 grids, Survival, X-Tile, native swipe and merge, Undo, saved progress after reopen, Auto.\n");
   finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream","FAIL: "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}
 }
}
