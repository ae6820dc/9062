package io.github.ae6820dc.unicode16single;
import android.app.*;
import android.os.*;
import android.content.Intent;
import java.util.concurrent.*;
public class SmokeInstrumentation extends Instrumentation {
 MainActivity a;
 @Override public void onCreate(Bundle b){super.onCreate(b);start();}
 String js(String s)throws Exception{ArrayBlockingQueue<String> q=new ArrayBlockingQueue<>(1);runOnMainSync(()->a.web.evaluateJavascript(s,q::add));String v=q.poll(15,TimeUnit.SECONDS);if(v==null)throw new AssertionError("JS timeout");return v;}
 void require(boolean b,String msg){if(!b)throw new AssertionError(msg);}
 void open()throws Exception{
  a=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  for(int i=0;i<100;i++){if("true".equals(js("document.readyState==='complete' && !!document.querySelector('#glyph span')")))return;Thread.sleep(100);}throw new AssertionError("Page load");
 }
 @Override public void onStart(){Bundle result=new Bundle();try{
  open();
  require("Unicode 16".contentEquals(getTargetContext().getApplicationInfo().loadLabel(getTargetContext().getPackageManager())),"App label");
  require("true".equals(js("document.querySelector('header').textContent.includes('F705B6D1B3E1325D')")),"Original Program ID");
  require("true".equals(js("document.getElementById('set').options.length===26")),"26 character sets");
  js("document.getElementById('set').value='en';document.getElementById('length').value='128';document.getElementById('ordinal').value='2';document.getElementById('apply').click()");
  require("true".equals(js("document.getElementById('glyph').textContent==='a'.repeat(127)+'b' && document.querySelectorAll('#glyph span').length===128")),"128-character enumeration");
  js("document.getElementById('prev').click()");
  require("true".equals(js("document.getElementById('glyph').textContent==='a'.repeat(128)")),"Previous");
  js("document.getElementById('next').click();document.getElementById('speed').value='0.05';document.getElementById('speed').dispatchEvent(new Event('change'));document.getElementById('start').click()");
  Thread.sleep(500);js("document.getElementById('start').click()");
  require("true".equals(js("BigInt(document.getElementById('ordinal').value)>2n")),"Playback advances");
  js("document.getElementById('set').value='hu';document.getElementById('length').value='128';document.getElementById('ordinal').value='9007199254740993';document.getElementById('apply').click()");
  require("true".equals(js("document.getElementById('error').textContent==='' && document.getElementById('ordinal').value==='9007199254740993'")),"Exact jump beyond Number range");
  runOnMainSync(()->a.finish());waitForIdleSync();open();
  require("true".equals(js("document.getElementById('set').value==='hu' && document.getElementById('length').value==='128' && document.getElementById('ordinal').value==='9007199254740993'")),"Saved state on reopen");
  js("document.getElementById('length').value='129';document.getElementById('apply').click()");
  require("true".equals(js("document.getElementById('error').textContent.length>0 && document.querySelectorAll('#glyph span').length===128")),"Length validation");
  result.putString("stream","PASS: Android 16 offline launch, original Program ID, 26 character sets, 128 characters, next/previous, playback, exact BigInt jump, saved state on reopen, length validation.\n");finish(Activity.RESULT_OK,result);
 }catch(Throwable e){result.putString("stream","FAIL: "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}}
}
