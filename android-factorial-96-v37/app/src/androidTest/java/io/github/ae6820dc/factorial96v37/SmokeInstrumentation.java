package io.github.ae6820dc.factorial96v37;
import android.app.*;
import android.os.*;
import android.content.Intent;
import java.util.concurrent.*;
public class SmokeInstrumentation extends Instrumentation {
 MainActivity a;
 @Override public void onCreate(Bundle b){super.onCreate(b);start();}
 String js(String s) throws Exception {
  ArrayBlockingQueue<String> q=new ArrayBlockingQueue<>(1);
  runOnMainSync(()->a.web.evaluateJavascript(s,q::add));
  String v=q.poll(10,TimeUnit.SECONDS);
  if(v==null)throw new AssertionError("JavaScript timeout");
  return v;
 }
 void require(boolean b,String msg){if(!b)throw new AssertionError(msg);}
 void open() throws Exception {
  a=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  for(int n=0;n<100;n++){if("true".equals(js("document.readyState==='complete' && !!document.getElementById('stage') && document.getElementById('stage').width>0")))return;Thread.sleep(100);}
  throw new AssertionError("Page did not load");
 }
 @Override public void onStart(){
  Bundle result=new Bundle();
  try{
   open();
   require(js("document.querySelector('h1').textContent").contains("6C9ABAD8C1CDA0C6"),"Program ID");
   require("true".equals(js("document.getElementById('stage').height>0")),"Canvas");
   js("localStorage.clear();location.reload();");
   Thread.sleep(1200);
   require("\"0\"".equals(js("document.getElementById('sValue').textContent")),"Initial counter");
   js("(()=>{const c=document.getElementById('stage'),r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('click',{clientX:r.left+15,clientY:r.top+15,bubbles:true}));return true})()");
   require("\"1\"".equals(js("document.getElementById('sValue').textContent")),"Cell tap");
   js("document.getElementById('n0').click()");
   require("\"0\"".equals(js("document.getElementById('sValue').textContent")),"Independent board");
   js("document.getElementById('n0').click();document.getElementById('autoToggle').click()");
   Thread.sleep(900);
   js("document.getElementById('autoToggle').click()");
   require("true".equals(js("Number(document.getElementById('sValue').textContent)>1")),"Random mode");
   String step=js("document.getElementById('sValue').textContent");
   runOnMainSync(()->a.finish());waitForIdleSync();open();
   require(step.equals(js("document.getElementById('sValue').textContent")),"Saved progress after reopen");
   result.putString("stream","PASS: offline launch, canvas, Program ID, cell tap, board switching, auto random, saved progress on Android 16.\n");
   finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream","FAIL: "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}
 }
}
