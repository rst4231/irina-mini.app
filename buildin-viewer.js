// Buildin viewer: same-origin proxy keeps internal navigation inside the Mini App.
(function(){
  var style=document.createElement('style');
  style.setAttribute('data-buildin-viewer-style','');
  style.textContent=`
.buildin-viewer{position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex!important;flex-direction:column!important;width:100%!important;height:100vh!important;height:100dvh!important;background:#f7f9fc!important;color:#0b1220!important;overscroll-behavior:contain!important;}
.buildin-viewer[hidden]{display:none!important;}
.buildin-viewer__bar{flex:0 0 auto!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:58px!important;padding:env(safe-area-inset-top,0) 12px 0!important;border-bottom:1px solid rgba(15,23,42,.08)!important;background:rgba(255,255,255,.96)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;box-shadow:0 7px 24px rgba(31,41,55,.06)!important;}
.buildin-viewer__actions{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;}
.buildin-viewer__action{appearance:none!important;-webkit-appearance:none!important;min-height:38px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;padding:0 14px!important;border:1px solid rgba(15,23,42,.08)!important;border-radius:999px!important;background:#eef4fb!important;color:#0b1220!important;font:inherit!important;font-size:13px!important;font-weight:800!important;line-height:1!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent!important;}
.buildin-viewer__action:active{transform:scale(.97)!important;}
.buildin-viewer__action svg{width:17px!important;height:17px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.buildin-viewer__frame-shell{flex:1 1 auto!important;min-height:0!important;width:100%!important;overflow:hidden!important;background:#fff!important;}
.buildin-viewer__frame{width:100%!important;height:calc(100% + 56px)!important;min-height:calc(100% + 56px)!important;border:0!important;background:#fff!important;transform:translateY(-56px)!important;}
body.buildin-viewer-open{overflow:hidden!important;touch-action:none!important;}
@media (prefers-reduced-motion:reduce){.buildin-viewer__action{transition:none!important;}}
`;
  document.head.appendChild(style);
})();
(function(){
  var HOST='buildin.ai';
  var viewer=null;
  var frame=null;
  var buildinHistory=[];
  var previousOverflow='';

  function textOf(el){return el&&el.textContent?el.textContent.replace(/\s+/g,' ').trim():'';}
  function parseBuildinUrl(value){
    if(!value)return null;
    try{
      var url=new URL(value,window.location.href);
      var host=String(url.hostname||'').toLowerCase();
      if(url.protocol!=='https:')return null;
      if(host!==HOST&&!host.endsWith('.'+HOST))return null;
      return url.href;
    }catch(_){return null;}
  }
  function isBlocked(anchor){
    if(!anchor)return true;
    var selector='[aria-disabled="true"],[disabled],[data-disabled="true"],[data-locked="true"],.disabled,.locked,.is-disabled,.is-locked,.training-step--disabled,.training-step--locked';
    if(anchor.matches(selector)||anchor.closest(selector))return true;
    try{var style=window.getComputedStyle(anchor);if(style.pointerEvents==='none'||style.display==='none'||style.visibility==='hidden')return true;}catch(_){}
    return false;
  }
  function ensureViewer(){
    if(viewer&&viewer.isConnected)return viewer;
    viewer=document.createElement('section');
    viewer.className='buildin-viewer';
    viewer.hidden=true;
    viewer.setAttribute('data-buildin-viewer','');
    viewer.setAttribute('role','dialog');
    viewer.setAttribute('aria-modal','true');
    var bar=document.createElement('div');bar.className='buildin-viewer__bar';
    var actions=document.createElement('div');actions.className='buildin-viewer__actions';
    var back=document.createElement('button');back.type='button';back.className='buildin-viewer__action buildin-viewer__action--back';back.setAttribute('aria-label','Назад');back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Назад</span>';back.addEventListener('click',goBack);
    var home=document.createElement('button');home.type='button';home.className='buildin-viewer__action buildin-viewer__action--home';home.setAttribute('aria-label','Домой');home.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></svg><span>Домой</span>';home.addEventListener('click',goHome);
    actions.appendChild(back);actions.appendChild(home);
    frame=document.createElement('iframe');frame.className='buildin-viewer__frame';frame.setAttribute('title','Материал Buildin AI');frame.setAttribute('loading','eager');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frame.setAttribute('allow','clipboard-read; clipboard-write');
    var shell=document.createElement('div');shell.className='buildin-viewer__frame-shell';shell.appendChild(frame);
    bar.appendChild(actions);viewer.appendChild(bar);viewer.appendChild(shell);document.body.appendChild(viewer);return viewer;
  }
  function proxyUrl(url){return '/api/buildin?url='+encodeURIComponent(url);}
  function loadBuildin(url){var safeUrl=parseBuildinUrl(url);if(!safeUrl||!frame)return;frame.src=proxyUrl(safeUrl);}
  function openViewer(url){
    var safeUrl=parseBuildinUrl(url);if(!safeUrl)return;
    ensureViewer();previousOverflow=document.body.style.overflow||'';buildinHistory=[safeUrl];loadBuildin(safeUrl);viewer.hidden=false;document.body.classList.add('buildin-viewer-open');document.body.style.overflow='hidden';
    var back=viewer.querySelector('.buildin-viewer__action--back');if(back)requestAnimationFrame(function(){back.focus({preventScroll:true});});
  }
  function goBack(){
    if(!viewer||viewer.hidden)return;
    if(buildinHistory.length>1){buildinHistory.pop();loadBuildin(buildinHistory[buildinHistory.length-1]);return;}
    closeViewer();
  }
  function goHome(){closeViewer();try{window.scrollTo({top:0,left:0,behavior:'instant'});}catch(_){window.scrollTo(0,0);}}
  function closeViewer(){if(!viewer||viewer.hidden)return;viewer.hidden=true;if(frame)frame.src='about:blank';buildinHistory=[];document.body.classList.remove('buildin-viewer-open');document.body.style.overflow=previousOverflow;}

  document.addEventListener('click',function(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var target=event.target;if(!(target instanceof Element))return;
    var anchor=target.closest('a[href]');
    if(!anchor||anchor.id==='application-button'||isBlocked(anchor))return;
    var url=parseBuildinUrl(anchor.getAttribute('href')||anchor.href);if(!url)return;
    event.preventDefault();event.stopImmediatePropagation();openViewer(url,textOf(anchor)||'Материал');
  },true);

  window.addEventListener('message',function(event){
    if(!frame||event.source!==frame.contentWindow)return;
    if(event.origin!==window.location.origin)return;
    var data=event.data;if(!data)return;
    var nextUrl=parseBuildinUrl(data.url);if(!nextUrl)return;
    var current=buildinHistory.length?buildinHistory[buildinHistory.length-1]:null;
    if(data.type==='buildin:history-replace'){
      if(buildinHistory.length)buildinHistory[buildinHistory.length-1]=nextUrl;else buildinHistory=[nextUrl];
      return;
    }
    if(data.type==='buildin:history-push'){
      if(current!==nextUrl)buildinHistory.push(nextUrl);
      return;
    }
    if(data.type!=='buildin:navigate'||current===nextUrl)return;
    buildinHistory.push(nextUrl);loadBuildin(nextUrl);
  });

  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&viewer&&!viewer.hidden){event.preventDefault();closeViewer();}});
})();
