package io.github.ae6820dc.studio;

import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.view.*;
import android.webkit.WebView;
import org.json.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;

/** Runs only in an explicitly installed Android test package on a test device. */
public final class SmokeInstrumentation extends Instrumentation {
    private Bundle arguments;
    private Activity activity;
    private WebView web;
    private final ArrayList<String> checks=new ArrayList<>();
    @Override public void onCreate(Bundle args){arguments=args;start();}
    private void require(boolean condition,String label){if(!condition)throw new AssertionError(label);checks.add(label);}
    private String eval(String js) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);String[] result={null};
        runOnMainSync(()->web.evaluateJavascript(js,value->{result[0]=value;latch.countDown();}));
        if(!latch.await(60,TimeUnit.SECONDS))throw new AssertionError("WebView evaluate timeout: "+js);
        return result[0];
    }
    private void waitFor(String js) throws Exception {
        long deadline=System.currentTimeMillis()+90000;
        while(System.currentTimeMillis()<deadline){if("true".equals(eval(js)))return;Thread.sleep(250);}
        throw new AssertionError("Page timeout: "+js);
    }
    private boolean menuRows(android.view.accessibility.AccessibilityNodeInfo node,int expected){
        if(node==null)return false;
        android.view.accessibility.AccessibilityNodeInfo.CollectionInfo info=node.getCollectionInfo();
        if(info!=null && info.getRowCount()==expected)return true;
        for(int i=0;i<node.getChildCount();i++)if(menuRows(node.getChild(i),expected))return true;
        return false;
    }
    @Override public void onStart(){
        Bundle result=new Bundle();
        try {
            Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage(getTargetContext().getPackageName());
            if(launch==null)throw new AssertionError("No launcher");
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
            activity=startActivitySync(launch);
            Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);web=(WebView)field.get(activity);
            Field catalog=MainActivity.class.getDeclaredField("programs");catalog.setAccessible(true);
            @SuppressWarnings("unchecked") List<JSONObject> programs=(List<JSONObject>)catalog.get(activity);
            if(getTargetContext().getPackageName().endsWith("unicodestudio"))
                require(programs.size()==("upgrade-seed".equals(arguments.getString("phase"))?27:33),"complete Unicode catalog");
            Method open=MainActivity.class.getDeclaredMethod("open",JSONObject.class);open.setAccessible(true);
            Method leave=MainActivity.class.getDeclaredMethod("leave",Runnable.class);leave.setAccessible(true);
            Method menu=MainActivity.class.getDeclaredMethod("menu");menu.setAccessible(true);
            runOnMainSync(()->{try{menu.invoke(activity);}catch(Exception e){throw new RuntimeException(e);}});
            getUiAutomation().waitForIdle(500,10000);
            require(menuRows(getUiAutomation().getRootInActiveWindow(),programs.size()),"Programs menu contains every catalog entry");
            sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            for(JSONObject p:programs){
                CountDownLatch switched=new CountDownLatch(1);
                runOnMainSync(()->{try{leave.invoke(activity,(Runnable)()->{try{open.invoke(activity,p);switched.countDown();}catch(Exception e){throw new RuntimeException(e);}});}catch(Exception e){throw new RuntimeException(e);}});
                require(switched.await(30,TimeUnit.SECONDS),"native switch "+p.getString("id"));
                waitFor("location.hostname==="+JSONObject.quote(p.getString("id")+".appassets.androidplatform.net")+" && document.readyState==='complete' && !!window.studioDownload");
                require("true".equals(eval("isSecureContext")),"secure offline origin "+p.getString("id"));
                String probe="studio.instrumentation.probe",id=p.getString("id");
                if("verify".equals(arguments.getString("phase")) || ("upgrade".equals(arguments.getString("phase")) && programs.indexOf(p)<27))require(JSONObject.quote(id).equals(eval("localStorage.getItem('"+probe+"')")),"restart persistence "+id);
                eval("localStorage.setItem('"+probe+"',"+JSONObject.quote(id)+")");
                eval("delete window.studioDownload");runOnMainSync(()->web.reload());waitFor("location.hostname==="+JSONObject.quote(p.getString("id")+".appassets.androidplatform.net")+" && document.readyState==='complete' && !!window.studioDownload");
                require(JSONObject.quote(id).equals(eval("localStorage.getItem('"+probe+"')")),"reload persistence "+id);
                require("true".equals(eval("Object.entries(localStorage).filter(([k])=>k==='"+probe+"').every(([,v])=>v==="+JSONObject.quote(id)+")")),"isolated state "+id);
                if(!"chess".equals(p.getString("kind")))require("true".equals(eval("document.body.innerText.includes("+JSONObject.quote(p.getString("programId"))+")")),"original Program ID "+id);
                if("calculator".equals(p.getString("kind"))){
                    eval("document.querySelector('#calculate').click()");
                    waitFor("!document.querySelector('#calculate').disabled");
                    require("true".equals(eval("document.querySelector('#error').hidden && !document.querySelector('#result').hidden")),"calculator offline worker result "+id);
                }
                if("chess".equals(p.getString("kind"))){
                    eval("import('./engine.js').then(async m=>{const a=new m.StockfishAdapter();try{const range=await a.ready;const move=await a.move({moves:[],difficulty:'MAX',milliseconds:50});window.__engineProof={range,move};}finally{a.close()}}).catch(e=>window.__engineError=String(e))");
                    waitFor("!!window.__engineProof || !!window.__engineError");
                    require("true".equals(eval("!!window.__engineProof && /^[a-h][1-8][a-h][1-8]/.test(window.__engineProof.move)")),"Stockfish WASM worker legal-format move");
                }
                if("Unicode 10".equals(p.optString("group")) || "Unicode 11".equals(p.optString("group"))){
                    String positive="Unicode 10".equals(p.getString("group"))?"true":"false";
                    require("true".equals(eval("(()=>{const select=document.getElementById('set');for(const option of select.options){select.value=option.value;select.dispatchEvent(new Event('change'));if(timer!==null)cancelAnimationFrame(timer);display();const before=offset;timer=1;last=1000;frame(1050);cancelAnimationFrame(timer);timer=null;if((offset>before)!=="+positive+")return false;}return true})()")),"all character sets have required animation direction "+id);
                }
                if("unicode-10-1".equals(id)){
                    eval("localStorage.setItem('studio-native-backup', 'restored')");
                    String encoded=eval("JSON.stringify({schema:1,program:"+JSONObject.quote(id)+",localStorage:Object.fromEntries(Object.entries(localStorage))})");
                    String payload=new JSONArray("["+encoded+"]").getString(0);
                    java.io.File backup=new java.io.File(getTargetContext().getCacheDir(),"instrumentation-backup.json");
                    try(java.io.FileOutputStream out=new java.io.FileOutputStream(backup)){out.write(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
                    eval("window.__beforeNativeImport=true;localStorage.clear()");
                    Field importOrigin=MainActivity.class.getDeclaredField("importOrigin");importOrigin.setAccessible(true);
                    importOrigin.set(activity,"https://"+id+".appassets.androidplatform.net");
                    Method importResult=MainActivity.class.getDeclaredMethod("onActivityResult",int.class,int.class,Intent.class);importResult.setAccessible(true);
                    Intent imported=new Intent().setData(android.net.Uri.fromFile(backup));
                    runOnMainSync(()->{try{importResult.invoke(activity,3,Activity.RESULT_OK,imported);}catch(Exception e){throw new RuntimeException(e);}});
                    getUiAutomation().waitForIdle(500,10000);
                    boolean confirmed=false;
                    for(android.view.accessibility.AccessibilityNodeInfo node:getUiAutomation().getRootInActiveWindow().findAccessibilityNodeInfosByText("Import")){
                        if("Import".contentEquals(node.getText()==null?"":node.getText()) && node.isClickable())confirmed=node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK);
                    }
                    require(confirmed,"native backup import confirmation");
                    waitFor("!window.__beforeNativeImport && document.readyState==='complete' && localStorage.getItem('studio-native-backup')==='restored' && !!window.studioDownload");
                    require(JSONObject.quote(id).equals(eval("localStorage.getItem('studio.instrumentation.probe')")),"native backup restores isolated state");
                    backup.delete();
                }
                final boolean[] bars={false},geometry={false};
                runOnMainSync(()->{
                    View decor=activity.getWindow().getDecorView();WindowInsets insets=decor.getRootWindowInsets();
                    if(android.os.Build.VERSION.SDK_INT>=30 && insets!=null)bars[0]=insets.isVisible(WindowInsets.Type.statusBars())&&insets.isVisible(WindowInsets.Type.navigationBars());
                    int[] pos=new int[2];web.getLocationOnScreen(pos);
                    if(android.os.Build.VERSION.SDK_INT>=30 && insets!=null){android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars());geometry[0]=pos[1]>=safe.top && pos[1]+web.getHeight()<=decor.getHeight()-safe.bottom;}
                });
                require(bars[0],"both system bars visible "+id);require(geometry[0],"WebView between system bars "+id);
            }
            // Every marker must survive a complete second pass across origins.
            for(JSONObject p:programs){runOnMainSync(()->{try{open.invoke(activity,p);}catch(Exception e){throw new RuntimeException(e);}});waitFor("location.hostname==="+JSONObject.quote(p.getString("id")+".appassets.androidplatform.net")+" && document.readyState==='complete' && !!window.studioDownload");require(JSONObject.quote(p.getString("id")).equals(eval("localStorage.getItem('studio.instrumentation.probe')")),"switch-back persistence "+p.getString("id"));}
            result.putString("stream","PASS "+checks.size()+" Android checks\n"+String.join("\n",checks)+"\n");finish(Activity.RESULT_OK,result);
        } catch(Throwable e){result.putString("stream","FAIL after "+checks.size()+" checks: "+e+"\n"+String.join("\n",checks)+"\n");finish(Activity.RESULT_CANCELED,result);}
    }
}
