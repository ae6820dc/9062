package io.github.ae6820dc.hexic2048v13;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Insets;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.webkit.WebView;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
 WebView web;
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  FrameLayout root = new FrameLayout(this);
  root.setBackgroundColor(Color.rgb(250,248,239));
  root.setOnApplyWindowInsetsListener((v, wi) -> {
   if(android.os.Build.VERSION.SDK_INT>=30){
    Insets i=wi.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
    v.setPadding(i.left,i.top,i.right,i.bottom);
   } else {v.setPadding(wi.getSystemWindowInsetLeft(),wi.getSystemWindowInsetTop(),wi.getSystemWindowInsetRight(),wi.getSystemWindowInsetBottom());}
   return wi;
  });
  web=new WebView(this);
  web.setBackgroundColor(Color.rgb(250,248,239));
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(false);
  web.setWebChromeClient(new android.webkit.WebChromeClient());
  web.addJavascriptInterface(new Object(){
   @android.webkit.JavascriptInterface public void share(String text){
    runOnUiThread(()->{
     android.content.Intent send=new android.content.Intent(android.content.Intent.ACTION_SEND);
     send.setType("text/plain");send.putExtra(android.content.Intent.EXTRA_TEXT,text);
     startActivity(android.content.Intent.createChooser(send,"Pontszám megosztása"));
    });
   }
  },"AndroidShare");
  web.setWebViewClient(new WebViewClient() {
   @Override public void onPageFinished(WebView v,String url){
    v.evaluateJavascript("navigator.share = data => { AndroidShare.share(String(data.text || '')); return Promise.resolve(); };",null);
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v, android.webkit.WebResourceRequest r) { return true; }
  });
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));
  setContentView(root);
  web.loadUrl("file:///android_asset/index.html");
 }
 @Override protected void onPause(){web.onPause();web.pauseTimers();super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}}
 @Override protected void onDestroy(){web.destroy();super.onDestroy();}
}
