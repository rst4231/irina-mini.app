const BUILDIN_HOST = 'buildin.ai';

export function normalizeBuildinUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = String(url.hostname || '').toLowerCase();
    if (url.protocol !== 'https:') return null;
    if (host !== BUILDIN_HOST && !host.endsWith(`.${BUILDIN_HOST}`)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function injectBuildinBridge(html, pageUrl) {
  if (typeof html !== 'string') return html;
  const safe = normalizeBuildinUrl(pageUrl);
  if (!safe || !/<head(?:\s[^>]*)?>/i.test(html)) return html;

  const parsed = new URL(safe);
  const localPath = parsed.pathname + parsed.search + parsed.hash;
  const base = `<base href="${escapeAttr(safe)}">`;
  const bootstrap = `<script data-buildin-location-bootstrap>(function(){
    var HOST='buildin.ai';
    var BUILDIN_URL=${safeJson(safe)};
    var LOCAL_PATH=${safeJson(localPath)};
    function normalize(value){
      if(value==null)return null;
      try{
        var u=new URL(String(value),BUILDIN_URL);
        var host=String(u.hostname||'').toLowerCase();
        if(u.protocol!=='https:')return null;
        if(host!==HOST&&!host.endsWith('.'+HOST))return null;
        return u;
      }catch(_){return null;}
    }
    function localize(value){var u=normalize(value);return u?u.pathname+u.search+u.hash:value;}
    try{history.replaceState(history.state,'',LOCAL_PATH);}catch(_){}
    var nativePush=history.pushState.bind(history);
    var nativeReplace=history.replaceState.bind(history);
    history.pushState=function(state,title,url){
      var u=normalize(url);
      var result=nativePush(state,title,u?localize(u.href):url);
      if(u){try{parent.postMessage({type:'buildin:history-push',url:u.href},window.location.origin);}catch(_){}}
      return result;
    };
    history.replaceState=function(state,title,url){
      var u=normalize(url);
      var result=nativeReplace(state,title,u?localize(u.href):url);
      if(u){try{parent.postMessage({type:'buildin:history-replace',url:u.href},window.location.origin);}catch(_){}}
      return result;
    };
  })();</script>`;

  const bridge = `<script data-buildin-proxy-bridge>(function(){
    var HOST='buildin.ai';
    function normalize(value){
      try{
        var u=new URL(value,document.baseURI);
        var host=String(u.hostname||'').toLowerCase();
        if(u.protocol!=='https:')return null;
        if(host!==HOST&&!host.endsWith('.'+HOST))return null;
        return u.href;
      }catch(_){return null;}
    }
    function post(type,url){try{parent.postMessage({type:type,url:url},window.location.origin);}catch(_){}}
    function compactText(el){return String(el&&el.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase();}
    function buildinBrandLink(anchor){
      try{
        var u=new URL(anchor.href,document.baseURI);
        var host=String(u.hostname||'').toLowerCase();
        if(host!==HOST&&!host.endsWith('.'+HOST))return false;
        var p=String(u.pathname||'/').toLowerCase();
        return p==='/'||p.startsWith('/pricing')||p.startsWith('/login')||p.startsWith('/signup')||p.startsWith('/download');
      }catch(_){return false;}
    }
    function hide(el){if(el&&el.style)el.style.setProperty('display','none','important');}
    function hideBranding(){
      var candidates=document.querySelectorAll('header,footer,[role="banner"],[class*="banner"],[class*="promo"],[class*="advert"]');
      candidates.forEach(function(el){
        var text=compactText(el);
        var hasBrand=text.indexOf('buildin')!==-1||Array.prototype.some.call(el.querySelectorAll('a[href]'),buildinBrandLink);
        if(!hasBrand)return;
        var position='';
        try{position=getComputedStyle(el).position;}catch(_){}
        if(el.tagName==='HEADER'||el.tagName==='FOOTER'||position==='fixed'||position==='sticky')hide(el);
      });
      document.querySelectorAll('a[href]').forEach(function(anchor){
        if(!buildinBrandLink(anchor))return;
        var node=anchor;
        for(var i=0;i<4&&node&&node!==document.body;i++,node=node.parentElement){
          var text=compactText(node);
          var position='';
          try{position=getComputedStyle(node).position;}catch(_){}
          if(text.length<=320&&(text.indexOf('buildin')!==-1||position==='fixed'||position==='sticky')){hide(node);break;}
        }
      });
    }
    document.addEventListener('click',function(event){
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      var target=event.target;
      if(!(target instanceof Element))return;
      var anchor=target.closest('a[href]');
      if(!anchor)return;
      var next=normalize(anchor.getAttribute('href')||anchor.href);
      if(!next)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      post('buildin:navigate',next);
    },true);
    var nativeOpen=window.open;
    window.open=function(url,target,features){
      var next=normalize(url);
      if(next){post('buildin:navigate',next);return null;}
      return nativeOpen?nativeOpen.call(window,url,target,features):null;
    };
    function boot(){
      hideBranding();
      var scheduled=false;
      var observer=new MutationObserver(function(){
        if(scheduled)return;
        scheduled=true;
        requestAnimationFrame(function(){scheduled=false;hideBranding();});
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(hideBranding,300);
      setTimeout(hideBranding,1200);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  })();</script>`;

  let out = html;
  if (!out.includes('data-buildin-location-bootstrap')) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${bootstrap}${base}`);
  } else if (!out.includes('<base ')) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  if (!out.includes('data-buildin-proxy-bridge')) {
    out = out.replace(/<\/head>/i, `${bridge}</head>`);
  }
  return out;
}
