package io.github.ae6820dc.studio;
import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.view.*;
import android.webkit.WebView;
import android.widget.Button;
import org.json.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;

/** Exercise the installed app, including every real menu button, in airplane mode. */
public final class SmokeInstrumentation extends Instrumentation {
 private Activity activity;private WebView web;private int checks;private Bundle args;
 @Override public void onCreate(Bundle a){args=a;start();}
 private void require(boolean ok,String label){if(!ok)throw new AssertionError(label);checks++;}
 private String eval(String js)throws Exception{
  CountDownLatch latch=new CountDownLatch(1);String[] value={null};runOnMainSync(()->web.evaluateJavascript(js,v->{value[0]=v;latch.countDown();}));
  require(latch.await(30,TimeUnit.SECONDS),"JS timeout");return value[0];
 }
 private void waitFor(String js)throws Exception{long until=System.currentTimeMillis()+60000;while(System.currentTimeMillis()<until){if("true".equals(eval(js)))return;Thread.sleep(150);}throw new AssertionError("Page timeout: "+js);}
 private Button button(View view,String label){if(view instanceof Button && ((Button)view).getText().toString().equals(label))return (Button)view;if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++){Button b=button(g.getChildAt(i),label);if(b!=null)return b;}}return null;}
 private void click(String label){runOnMainSync(()->{Button b=button(activity.getWindow().getDecorView(),label);require(b!=null,"menu button "+label);b.performClick();});waitForIdleSync();}
 private void bars(){runOnMainSync(()->{View decor=activity.getWindow().getDecorView();WindowInsets insets=decor.getRootWindowInsets();require(insets.isVisible(WindowInsets.Type.statusBars())&&insets.isVisible(WindowInsets.Type.navigationBars()),"system bars visible");if(web.getParent()!=null){int[] pos=new int[2];web.getLocationOnScreen(pos);android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars());require(pos[1]>=safe.top && pos[1]+web.getHeight()<=decor.getHeight()-safe.bottom,"content within system bars");}});}
 @Override public void onStart(){Bundle result=new Bundle();try{
  Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage(getTargetContext().getPackageName());require(launch!=null,"launcher");launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);activity=startActivitySync(launch);
  Field w=MainActivity.class.getDeclaredField("web");w.setAccessible(true);web=(WebView)w.get(activity);
  Field c=MainActivity.class.getDeclaredField("programs");c.setAccessible(true);@SuppressWarnings("unchecked") List<JSONObject> programs=(List<JSONObject>)c.get(activity);
  require(programs.size()==72,"72 catalog entries");bars();
  for(int version=1;version<=15;version++){
   int count=version>=13?12:3;click("Unicode "+version+" · "+count+" samples");
   for(JSONObject p:programs){if(!p.getString("group").equals("Unicode "+version))continue;
    click(p.getString("name"));String id=p.getString("id");
    waitFor("location.hostname==="+JSONObject.quote(id+".appassets.androidplatform.net")+" && document.readyState==='complete' && !!window.studioDownload");
    require("true".equals(eval("isSecureContext")),"secure local origin");
    require("true".equals(eval("document.body.innerText.includes("+JSONObject.quote(p.getString("programId"))+")")),"Program ID "+id);
    String old=eval("localStorage.getItem('__studio_runtime_test')");
    require(("verify".equals(args.getString("phase"))?JSONObject.quote(id):"null").equals(old),"isolated/restart storage "+id);
    eval("localStorage.setItem('__studio_runtime_test',"+JSONObject.quote(id)+")");
    for(int k=0;k<p.getJSONArray("storageKeys").length();k++)require("true".equals(eval("document.documentElement.innerHTML.includes("+JSONObject.quote(p.getJSONArray("storageKeys").getString(k))+")")),"original storage key");
    eval("if(document.getElementById('fullscreen'))document.getElementById('fullscreen').click()");Thread.sleep(200);bars();
    click("Samples");click(p.getString("name"));waitFor("location.hostname==="+JSONObject.quote(id+".appassets.androidplatform.net")+" && document.readyState==='complete' && !!window.studioDownload");
    require(JSONObject.quote(id).equals(eval("localStorage.getItem('__studio_runtime_test')")),"switch persistence "+id);
    click("‹ Back");
   }
   click("‹ Back");
  }
  click("Unicode 15 · 12 samples");click("Sample 12");waitFor("!!window.studioDownload");click("Home");click("Unicode 1 · 3 samples");click("‹ Back");bars();
  result.putString("stream","PASS "+checks+" checks: all 72 samples, menus, IDs, keys, offline storage and system bars\n");finish(Activity.RESULT_OK,result);
 }catch(Throwable e){result.putString("stream","FAIL after "+checks+" checks: "+e+"\n"+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}}
}
