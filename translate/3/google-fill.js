/* Optional online assistant. Credentials stay in memory; personal entries stay local. */
'use strict';
window.googleFill = (() => {
  const $ = id => document.getElementById(id);
  let languages, config, configPromise, libraryPromise, token = null, machine = {}, controller, session = 0;
  let suppress = false, retryDelay = 0;
  const norm = value => value.trim().normalize('NFC');
  function message(text, error=false) {$('google-status').textContent=text;$('google-status').classList.toggle('form-error',error);}
  function option(code, text){const el=document.createElement('option');el.value=code;el.textContent=text;return el;}
  function badge(){const a=document.createElement('a');a.href='https://translate.google.com/';a.target='_blank';a.rel='noopener noreferrer';a.className='google-badge';const img=document.createElement('img');img.src='google-translate-attribution.png';img.alt='Powered by Google Translate';img.width=176;img.height=16;a.append(img);return a;}
  function cancel(){session++;controller?.abort();controller=null;$('google-cancel').hidden=true;refresh();}
  function refresh(){
    if(!languages)return;
    const source=$('google-source').value;
    for(const checkbox of $('google-targets').querySelectorAll('input')){
      checkbox.disabled=checkbox.value===source||!!norm($('term-'+checkbox.value).value);
      checkbox.closest('label').classList.toggle('unavailable',checkbox.disabled);
    }
    $('google-fill').disabled=!config?.serviceUrl||!token||!!controller||!navigator.onLine||Date.now()<retryDelay;
    $('google-signout').hidden=!token;
  }
  async function loadConfig(){
    if(configPromise)return configPromise;
    configPromise=(async()=>{
      const response=await fetch('google-config.json',{cache:'no-store'});if(!response.ok)throw new Error('Connection settings could not be read. Try again online.');
      const value=await response.json();
      if(!value.serviceUrl||!value.clientId){config={serviceUrl:'',clientId:''};$('google-setup').hidden=false;message('Automatic Google Translate filling is not connected yet. Your personal dictionary works normally.');return config;}
      const url=new URL(value.serviceUrl);
      if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value.clientId))throw new Error('The Google Translate connection settings need attention. See the connection guide.');
      config={serviceUrl:url.href.replace(/\/$/,''),clientId:value.clientId};$('google-setup').hidden=true;for(const id of ['google-controls','google-actions','google-privacy'])$(id).hidden=false;return config;
    })().catch(error=>{configPromise=null;throw error;});
    return configPromise;
  }
  async function loadIdentity(){
    if(window.google?.accounts?.id)return;
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
      const timer=setTimeout(()=>{script.remove();reject(new Error('Google sign-in did not load. Check your connection or browser settings.'));},15000);
      script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Google sign-in is unavailable. Manual editing still works.'));};document.head.append(script);
    }).catch(error=>{libraryPromise=null;throw error;});
    return libraryPromise;
  }
  async function connect(){
    if(!navigator.onLine){message('Google Translate needs an internet connection. Saved words remain available offline.');refresh();return;}
    try{
      message('Checking Google Translate connection…');await loadConfig();if(!config.serviceUrl){refresh();return;}
      await loadIdentity();
      if(!$('google-signin').hasChildNodes()){
        google.accounts.id.initialize({client_id:config.clientId,auto_select:false,callback:result=>{token=result.credential;message('Signed in. Choose your source expression and empty languages, then request translations.');refresh();}});
        google.accounts.id.renderButton($('google-signin'),{type:'standard',theme:'outline',size:'medium',text:'signin_with',width:220});
      }
      message(token?'Ready. Only selected empty fields will be filled.':'Sign in with an account allowed by the owner to request translations.');refresh();
    }catch(error){message(error.message,true);refresh();}
  }
  async function fill(){
    const source=$('google-source').value,text=norm($('term-'+source).value);
    const targets=[...$('google-targets').querySelectorAll('input:checked:not(:disabled)')].map(el=>el.value);
    if(!text){message('Enter an expression in the chosen source language first.',true);$('term-'+source).focus();return;}
    if(!targets.length){message('Choose at least one empty target language. Existing expressions will not be replaced.',true);return;}
    if(!navigator.onLine){message('Google Translate needs an internet connection.',true);return;}
    if(!token||!config?.serviceUrl){message('Connect and sign in before requesting translations.',true);return;}
    if(controller||Date.now()<retryDelay)return;
    const requestSession=session, snapshot=Object.fromEntries(Object.keys(languages).map(lang=>[lang,$('term-'+lang).value]));
    controller=new AbortController();const active=controller;const timer=setTimeout(()=>active.abort(),30000);
    $('google-cancel').hidden=false;refresh();message('Requesting '+targets.length+' translations. You can keep editing; your text will be preserved.');
    try{
      const response=await fetch(config.serviceUrl+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},credentials:'omit',body:JSON.stringify({source,text,targets}),signal:active.signal});
      if(response.status===401){token=null;throw new Error('Your Google sign-in has expired. Sign in again and retry.');}
      if(response.status===429){retryDelay=Date.now()+60000;setTimeout(refresh,60000);throw new Error('Translation limit reached. Wait a minute or try again tomorrow if the daily allowance is used.');}
      const payload=await response.json();
      if(!response.ok)throw new Error(response.status===403?'This account is not enabled for translation. Use the account allowed by the owner.':response.status===503?'Google Translate is temporarily unavailable. Your expressions have not changed.':'The translation request failed. Your expressions have not changed.');
      if(!payload.translations||typeof payload.translations!=='object'||Array.isArray(payload.translations)||!Array.isArray(payload.failed))throw new Error('Unexpected translation response. Nothing was filled.');
      // Validate every suggestion before changing any input.
      for(const [lang,value] of Object.entries(payload.translations))if(!targets.includes(lang)||typeof value!=='string'||!norm(value)||value.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value))throw new Error('Invalid translation response. Nothing was filled.');
      if(requestSession!==session||!$('expression-dialog').open)return;
      if($('google-source').value!==source||$('term-'+source).value!==snapshot[source]){message('Your source expression changed while translating. Nothing was filled; request new translations.');return;}
      let filled=0,kept=0;
      suppress=true;
      for(const [lang,value] of Object.entries(payload.translations)){
        if($('term-'+lang).value!==snapshot[lang]||norm($('term-'+lang).value)){kept++;continue;}
        $('term-'+lang).value=norm(value);machine[lang]={provider:'google',sourceLanguage:source,translatedAt:Date.now(),edited:false};$('term-'+lang).lang=lang+'-x-mtfrom-'+source;filled++;
      }
      suppress=false;$('google-attribution').hidden=!Object.keys(machine).length;
      message(filled+' suggestions filled. Review them before saving.'+(kept?' '+kept+' fields you edited were kept.':'')+(payload.failed.length?' Some languages could not be translated; retry the remaining empty fields.':''));
    }catch(error){if(requestSession===session)message(error.name==='AbortError'?'Translation cancelled or timed out. Existing expressions were kept.':error.message,true);}
    finally{clearTimeout(timer);if(controller===active)controller=null;if(requestSession===session)$('google-cancel').hidden=true;refresh();}
  }
  function init(manifest){
    languages=manifest.languages;
    for(const [lang,info] of Object.entries(languages)){
      $('google-source').append(option(lang,info.name));
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=lang;check.checked=true;label.append(check,document.createTextNode(info.name));$('google-targets').append(label);
      $('term-'+lang).addEventListener('input',()=>{if(!suppress&&machine[lang]){if(norm($('term-'+lang).value)){machine[lang].edited=true;$('term-'+lang).lang=lang;}else delete machine[lang];}$('google-attribution').hidden=!Object.keys(machine).length;refresh();});
    }
    $('google-panel').addEventListener('toggle',()=>{if($('google-panel').open)connect();});
    $('google-source').onchange=refresh;$('google-fill').onclick=fill;
    $('google-cancel').onclick=()=>{cancel();message('Translation cancelled. Your expressions were kept.');};
    $('google-signout').onclick=()=>{cancel();token=null;window.google?.accounts?.id.disableAutoSelect();message('Signed out. Your saved dictionary stays on this device.');refresh();};
    $('expression-dialog').addEventListener('close',cancel);$('expression-dialog').addEventListener('cancel',cancel);
    window.addEventListener('offline',()=>{cancel();if($('google-panel').open)message('Offline. Google Translate is unavailable; your saved words still work.');});
    window.addEventListener('online',()=>{refresh();if($('google-panel').open)connect();});
  }
  function open(entry){
    cancel();machine=structuredClone(entry?.machineTranslations||{});$('google-panel').open=false;
    $('google-source').value=$('from').value;
    if(!norm($('term-'+$('google-source').value).value))$('google-source').value=Object.keys(languages).find(lang=>norm($('term-'+lang).value))||$('from').value;
    for(const check of $('google-targets').querySelectorAll('input'))check.checked=true;
    for(const lang of Object.keys(languages))$('term-'+lang).lang=machine[lang]&&!machine[lang].edited?lang+'-x-mtfrom-'+machine[lang].sourceLanguage:lang;
    $('google-attribution').hidden=!Object.keys(machine).length;message('Open this panel to request optional online translations.');refresh();
  }
  return {init,open,badge,metadata:()=>structuredClone(Object.fromEntries(Object.entries(machine).filter(([lang])=>norm($('term-'+lang).value))))};
})();
