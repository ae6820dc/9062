package io.github.ae6820dc.unicode14single;
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
  for(int i=0;i<100;i++){if("true".equals(js("document.readyState==='complete' && !!document.getElementById('codepoint') && document.getElementById('poolCount').textContent.includes('26')")))return;Thread.sleep(100);}throw new AssertionError("Page load");
 }
 @Override public void onStart(){Bundle result=new Bundle();try{
  open();
  require("Unicode 14".contentEquals(getTargetContext().getApplicationInfo().loadLabel(getTargetContext().getPackageManager())),"App name");
  require("true".equals(js("document.querySelector('header').textContent.includes('84ABE3DBF8C23C7C059E633757F96E7C')")),"Original ID");
  require("true".equals(js("document.getElementById('set').options.length===28")),"28 sets");
  js("document.getElementById('next').click()");
  require("true".equals(js("document.getElementById('glyph').textContent==='b' && document.getElementById('codepoint').textContent==='U+0062'")),"Next and codepoint");
  js("document.getElementById('prev').click()");
  require("true".equals(js("document.getElementById('glyph').textContent==='a'")),"Previous");
  js("document.getElementById('jumpButton').click();document.getElementById('jumpInput').value='26';document.getElementById('jumpGo').click()");
  require("true".equals(js("document.getElementById('glyph').textContent==='z'")),"Ordinal search");
  js("document.getElementById('jumpButton').click();const radio=document.querySelector('input[name=jumpMode][value=unicode]');radio.checked=true;radio.dispatchEvent(new Event('change'));document.getElementById('jumpInput').value='0062';document.getElementById('jumpGo').click()");
  require("true".equals(js("document.getElementById('glyph').textContent==='b' && document.getElementById('codepoint').textContent==='U+0062'")),"Codepoint search");
  js("document.getElementById('jumpButton').click();document.getElementById('jumpInput').value='999999';document.getElementById('jumpGo').click()");
  require("true".equals(js("document.getElementById('jumpError').textContent.length>0")),"Invalid search");
  runOnMainSync(()->a.onBackPressed());Thread.sleep(200);
  require("true".equals(js("!document.getElementById('jumpOverlay').classList.contains('open')")),"Android Back closes search");
  js("document.getElementById('speed').value='0.05';document.getElementById('speed').dispatchEvent(new Event('change'));document.getElementById('start').click()");
  Thread.sleep(250);js("document.getElementById('start').click()");
  require("true".equals(js("JSON.parse(localStorage.getItem('E575C375A80632A5')).count>2")),"Playback");
  js("document.getElementById('set').value='vi';document.getElementById('set').dispatchEvent(new Event('change'))");
  require("true".equals(js("parseInt(document.getElementById('poolCount').textContent.replace(/[^0-9]/g,''))>100")),"Vietnamese set");
  js("document.getElementById('set').value='en';document.getElementById('set').dispatchEvent(new Event('change'));document.getElementById('jumpButton').click();document.getElementById('jumpInput').value='13';document.getElementById('jumpGo').click()");
  String snapshot=js("localStorage.getItem('E575C375A80632A5')");
  runOnMainSync(()->a.finish());waitForIdleSync();open();
  require(snapshot.equals(js("localStorage.getItem('E575C375A80632A5')")),"Saved state on reopen");
  require("true".equals(js("document.getElementById('glyph').textContent==='m' && document.getElementById('codepoint').textContent==='U+006D'")),"Saved character and codepoint");
  result.putString("stream","PASS: Android 16 offline launch, original ID, 28 sets, next/previous, codepoint display, ordinal and Unicode search, invalid input, Android Back, playback, Vietnamese set, saved state on reopen.\n");finish(Activity.RESULT_OK,result);
 }catch(Throwable e){result.putString("stream","FAIL: "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}}
}