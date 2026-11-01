package io.github.ae6820dc.studio;

import android.app.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.webkit.WebView;
import android.widget.*;
import org.json.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;

/** Offline tests run only in the dedicated Explorer test package/emulator. */
public final class ExplorerInstrumentation extends Instrumentation {
    private Bundle args;
    private MainActivity activity;
    private WebView web;
    private final ArrayList<String> checks=new ArrayList<>();
    @Override public void onCreate(Bundle arguments){args=arguments;start();}
    private void require(boolean ok,String label){if(!ok)throw new AssertionError(label);checks.add(label);}
    private String eval(String js)throws Exception{
        CountDownLatch done=new CountDownLatch(1);String[] result={null};
        runOnMainSync(()->web.evaluateJavascript(js,value->{result[0]=value;done.countDown();}));
        if(!done.await(60,TimeUnit.SECONDS))throw new AssertionError("JS timeout");return result[0];
    }
    private void waitFor(String js)throws Exception{
        long end=System.currentTimeMillis()+90000;
        while(System.currentTimeMillis()<end){if("true".equals(eval(js)))return;Thread.sleep(100);}
        throw new AssertionError("Page condition timed out: "+js);
    }
    private void ready(JSONObject p)throws Exception{
        waitFor("location.hostname==="+JSONObject.quote(p.getString("id")+".appassets.androidplatform.net")+" && document.readyState==='complete' && !!window.studioDownload && typeof ready!=='undefined' && ready && !busy && document.getElementById('storageNotice').hidden");
    }
    private boolean hostButtons(View v){
        if(v instanceof Button && Arrays.asList("‹ Back","Home","Programs","Backup").contains(((Button)v).getText().toString()))return true;
        if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)if(hostButtons(g.getChildAt(i)))return true;}return false;
    }
    private int sampleButtons(View v){int n=v instanceof Button&&((Button)v).getText().toString().matches("Sample \\d+")?1:0;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)n+=sampleButtons(g.getChildAt(i));}return n;}
    private void nativeLayout(){runOnMainSync(()->{
        View root=activity.findViewById(android.R.id.content);require(!hostButtons(root),"native host toolbar absent");
        WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();require(insets!=null&&insets.isVisible(WindowInsets.Type.statusBars())&&insets.isVisible(WindowInsets.Type.navigationBars()),"system bars visible");
    });}
    private void createFile(String filename)throws Exception{
        eval("document.getElementById('newFile').click();document.getElementById('fileName').value="+JSONObject.quote(filename)+";document.getElementById('fileForm').requestSubmit()");
        waitFor("!busy && !document.getElementById('fileDialog').open && currentFiles.some(f=>f.name==="+JSONObject.quote(filename)+")");
    }
    @Override public void onStart(){Bundle result=new Bundle();try{
        Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage(getTargetContext().getPackageName());launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);activity=(MainActivity)startActivitySync(launch);
        Field wf=MainActivity.class.getDeclaredField("web");wf.setAccessible(true);web=(WebView)wf.get(activity);
        Field cf=MainActivity.class.getDeclaredField("programs");cf.setAccessible(true);
        @SuppressWarnings("unchecked") List<JSONObject> programs=(List<JSONObject>)cf.get(activity);
        require(programs.size()==48,"all 48 Explorer samples included");
        Set<String> ids=new HashSet<>(),databaseNames=new HashSet<>();Map<Integer,Integer> depths=new HashMap<>();
        for(JSONObject p:programs){require(ids.add(p.getString("id")),"unique origin "+p.getString("id"));require(databaseNames.add(p.getString("databaseName")),"unique IndexedDB "+p.getString("id"));depths.merge(p.getInt("depth"),1,Integer::sum);}
        for(int depth:new int[]{128,1024,8192,65536})require(depths.getOrDefault(depth,0)==12,"twelve samples at depth "+depth);
        runOnMainSync(()->require(sampleButtons(activity.findViewById(android.R.id.content))==48,"home chooser lists 48 samples"));nativeLayout();
        Method open=MainActivity.class.getDeclaredMethod("open",JSONObject.class);open.setAccessible(true);
        boolean verify="verify".equals(args.getString("phase"));
        for(JSONObject p:programs){
            String id=p.getString("id"),filename="egér-"+id+".exe";int depth=p.getInt("depth"),target=p.getInt("sample")==1?depth:p.getInt("sample");
            runOnMainSync(()->{try{open.invoke(activity,p);}catch(Exception e){throw new RuntimeException(e);}});ready(p);
            require("true".equals(eval("isSecureContext && MAX_DEPTH==="+depth+" && document.querySelector('footer code').textContent==="+JSONObject.quote(p.getString("programId")))),"original program and depth "+id);
            if(verify)require("true".equals(eval("path.length==="+target+" && currentFiles.length===1 && currentFiles[0].name==="+JSONObject.quote(filename))),"restart restores IndexedDB file and location "+id);
            else{
                eval("document.getElementById('address').value='/'+Array("+target+").fill('a').join('/');document.getElementById('addressForm').requestSubmit()");
                waitFor("!busy && path.length==="+target);createFile(filename);
            }
            require("true".equals(eval("currentFiles.length===1 && currentFiles[0].name==="+JSONObject.quote(filename))),"isolated file "+id);
            eval("window.__reloadProbe=true");runOnMainSync(()->web.reload());ready(p);waitFor("!window.__reloadProbe");ready(p);
            require("true".equals(eval("path.length==="+target+" && currentFiles.length===1 && currentFiles[0].name==="+JSONObject.quote(filename))),"reload persistence "+id);
            if(p.getInt("sample")==1){
                require("true".equals(eval("document.getElementById('terminal').hidden===false && !document.querySelector('[data-letter]')")),"final level supports saved file "+depth);
                eval("document.getElementById('address').value='/'+Array("+(depth+1)+").fill('b').join('/');document.getElementById('addressForm').requestSubmit()");
                require("true".equals(eval("path.length==="+depth)),"depth limit enforced "+depth);
                if(depth==65536){
                    require(Integer.parseInt(eval("document.querySelectorAll('#crumbs button').length"))<=26,"compact 65536-level breadcrumbs");
                    eval("document.querySelector('#crumbs button[aria-label=\"Jump to level\"]').click();document.getElementById('jumpLevel').value='512';document.getElementById('actionForm').requestSubmit()");waitFor("!busy && path.length===512");
                    eval("document.getElementById('back').click()");waitFor("!busy && path.length===65536");require("true".equals(eval("currentFiles.some(f=>f.name==="+JSONObject.quote(filename)+")")),"deep breadcrumb jump and return");
                }
            }
            if("explorer-1-1".equals(id)&&!verify){
                String disposable="delete-test.txt";createFile(disposable);
                eval("showAction('delete');for(const box of document.querySelectorAll('.delete-check'))if(actionFiles[Number(box.value)].name==='delete-test.txt'){box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));}document.getElementById('actionPassword').value='0000';document.getElementById('actionForm').requestSubmit()");
                require("true".equals(eval("currentFiles.some(f=>f.name==='delete-test.txt') && document.getElementById('actionError').textContent.includes('Incorrect')")),"wrong deletion password leaves file intact");
                eval("document.getElementById('actionPassword').value='1111';document.getElementById('actionForm').requestSubmit()");waitFor("!busy && !document.getElementById('actionDialog').open");
                require("true".equals(eval("currentFiles.length===1 && currentFiles[0].name==="+JSONObject.quote(filename))),"password deletion preserves unselected file");
            }
            nativeLayout();
        }
        Method back=MainActivity.class.getDeclaredMethod("back");back.setAccessible(true);
        eval("showAction('about')");runOnMainSync(()->{try{back.invoke(activity);}catch(Exception e){throw new RuntimeException(e);}});waitFor("!document.getElementById('actionDialog').open");require("true".equals(eval("ready")),"Android Back closes dialog first");
        runOnMainSync(()->{try{back.invoke(activity);}catch(Exception e){throw new RuntimeException(e);}});Thread.sleep(300);
        runOnMainSync(()->require(sampleButtons(activity.findViewById(android.R.id.content))==48,"Android Back returns to chooser"));
        result.putString("stream","PASS "+checks.size()+" Explorer Android checks\n"+String.join("\n",checks)+"\n");finish(Activity.RESULT_OK,result);
    }catch(Throwable error){result.putString("stream","FAIL after "+checks.size()+" checks: "+error+"\n"+String.join("\n",checks)+"\n");finish(Activity.RESULT_CANCELED,result);}}
}
