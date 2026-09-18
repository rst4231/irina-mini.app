// Synced from current Teacher CPA Buildin viewer. application-button stays external.
(function(){
  var style=document.createElement('style');
  style.setAttribute('data-buildin-viewer-style','');
  style.textContent="\n.buildin-viewer{\n  position:fixed!important;\n  inset:0!important;\n  z-index:2147483647!important;\n  display:flex!important;\n  flex-direction:column!important;\n  width:100%!important;\n  height:100vh!important;\n  height:100dvh!important;\n  background:#f7f9fc!important;\n  color:#0b1220!important;\n  overscroll-behavior:contain!important;\n}\n.buildin-viewer[hidden]{display:none!important;}\n.buildin-viewer__bar{\n  flex:0 0 auto!important;\n  display:flex!important;\n  align-items:center!important;\n  justify-content:center!important;\n  min-height:58px!important;\n  padding:env(safe-area-inset-top,0) 12px 0!important;\n  border-bottom:1px solid rgba(15,23,42,.08)!important;\n  background:rgba(255,255,255,.96)!important;\n  -webkit-backdrop-filter:blur(18px)!important;\n  backdrop-filter:blur(18px)!important;\n  box-shadow:0 7px 24px rgba(31,41,55,.06)!important;\n}\n.buildin-viewer__actions{\n  display:inline-flex!important;\n  align-items:center!important;\n  justify-content:center!important;\n  gap:8px!important;\n}\n.buildin-viewer__action{\n  appearance:none!important;\n  -webkit-appearance:none!important;\n  min-height:38px!important;\n  display:inline-flex!important;\n  align-items:center!important;\n  justify-content:center!important;\n  gap:7px!important;\n  padding:0 14px!important;\n  border:1px solid rgba(15,23,42,.08)!important;\n  border-radius:999px!important;\n  background:#eef4fb!important;\n  color:#0b1220!important;\n  font:inherit!important;\n  font-size:13px!important;\n  font-weight:800!important;\n  line-height:1!important;\n  cursor:pointer!important;\n  -webkit-tap-highlight-color:transparent!important;\n}\n.buildin-viewer__action:active{transform:scale(.97)!important;}\n.buildin-viewer__action svg{\n  width:17px!important;\n  height:17px!important;\n  display:block!important;\n  fill:none!important;\n  stroke:currentColor!important;\n  stroke-width:2!important;\n  stroke-linecap:round!important;\n  stroke-linejoin:round!important;\n}\n.buildin-viewer__frame-shell{\n  flex:1 1 auto!important;\n  min-height:0!important;\n  width:100%!important;\n  overflow:hidden!important;\n  background:#fff!important;\n}\n.buildin-viewer__frame{\n  width:100%!important;\n  height:calc(100% + 246px)!important;\n  min-height:calc(100% + 246px)!important;\n  border:0!important;\n  background:#fff!important;\n  transform:translateY(-56px)!important;\n}\nbody.buildin-viewer-open{overflow:hidden!important;touch-action:none!important;}\n@media (min-width:700px), (hover:hover) and (pointer:fine){\n  .buildin-viewer__frame{\n    height:calc(100% + 286px)!important;\n    min-height:calc(100% + 286px)!important;\n  }\n}\n@media (prefers-reduced-motion:reduce){\n  .buildin-viewer__action{transition:none!important;}\n}\n";
  document.head.appendChild(style);
})();
(function(){
  var HOST='buildin.ai';
  var viewer=null;
  var frame=null;
  var viewerHistoryArmed=false;
  var previousOverflow='';

  function textOf(el){
    return el&&el.textContent?el.textContent.replace(/\\s+/g,' ').trim():'';
  }

  function parseBuildinUrl(value){
    if(!value)return null;
    try{
      var url=new URL(value,window.location.href);
      var host=String(url.hostname||'').toLowerCase();
      if(url.protocol!=='https:')return null;
      if(host!==HOST&&!host.endsWith('.'+HOST))return null;
      return url.href;
    }catch(_){
      return null;
    }
  }

  function isBlocked(anchor){
    if(!anchor)return true;
    var selector='[aria-disabled="true"],[disabled],[data-disabled="true"],[data-locked="true"],.disabled,.locked,.is-disabled,.is-locked,.training-step--disabled,.training-step--locked';
    if(anchor.matches(selector)||anchor.closest(selector))return true;
    try{
      var style=window.getComputedStyle(anchor);
      if(style.pointerEvents==='none'||style.display==='none'||style.visibility==='hidden')return true;
    }catch(_){}
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

    var bar=document.createElement('div');
    bar.className='buildin-viewer__bar';

    var actions=document.createElement('div');
    actions.className='buildin-viewer__actions';

    var back=document.createElement('button');
    back.type='button';
    back.className='buildin-viewer__action buildin-viewer__action--back';
    back.setAttribute('aria-label','Назад');
    back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Назад</span>';
    back.addEventListener('click',goBack);

    var home=document.createElement('button');
    home.type='button';
    home.className='buildin-viewer__action buildin-viewer__action--home';
    home.setAttribute('aria-label','Домой');
    home.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></svg><span>Домой</span>';
    home.addEventListener('click',goHome);

    actions.appendChild(back);
    actions.appendChild(home);

    frame=document.createElement('iframe');
    frame.className='buildin-viewer__frame';
    frame.setAttribute('title','Материал Buildin AI');
    frame.setAttribute('loading','eager');
    frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
    frame.setAttribute('allow','clipboard-read; clipboard-write');

    var shell=document.createElement('div');
    shell.className='buildin-viewer__frame-shell';
    shell.appendChild(frame);

    bar.appendChild(actions);
    viewer.appendChild(bar);
    viewer.appendChild(shell);
    document.body.appendChild(viewer);
    return viewer;
  }

  function armViewerHistory(){
    if(viewerHistoryArmed)return;
    try{
      var currentState=window.history.state;
      var nextState=currentState&&typeof currentState==='object'?Object.assign({},currentState):{};
      nextState.__buildinViewer=true;
      window.history.pushState(nextState,'',window.location.href);
      viewerHistoryArmed=true;
    }catch(_){}
  }

  function loadBuildin(url){
    var safeUrl=parseBuildinUrl(url);
    if(!safeUrl||!frame)return;
    frame.src=safeUrl;
  }

  function openViewer(url,title){
    var safeUrl=parseBuildinUrl(url);
    if(!safeUrl)return;
    ensureViewer();
    previousOverflow=document.body.style.overflow||'';
    armViewerHistory();
    loadBuildin(safeUrl);
    viewer.hidden=false;
    document.body.classList.add('buildin-viewer-open');
    document.body.style.overflow='hidden';
    var back=viewer.querySelector('.buildin-viewer__action--back');
    if(back)requestAnimationFrame(function(){back.focus({preventScroll:true});});
  }

  function goBack(){
    if(!viewer||viewer.hidden)return;
    if(viewerHistoryArmed){
      window.history.back();
      return;
    }
    closeViewer();
  }

  function goHome(){
    window.location.replace('/');
  }

  function closeViewer(){
    if(!viewer||viewer.hidden)return;
    viewer.hidden=true;
    if(frame)frame.src='about:blank';
    document.body.classList.remove('buildin-viewer-open');
    document.body.style.overflow=previousOverflow;
  }

  document.addEventListener('click',function(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var target=event.target;
    if(!(target instanceof Element))return;
    var anchor=target.closest('a[href]');
    if(!anchor||anchor.id==='application-button'||isBlocked(anchor))return;
    var url=parseBuildinUrl(anchor.getAttribute('href')||anchor.href);
    if(!url)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openViewer(url,textOf(anchor)||'Материал');
  },true);

  window.addEventListener('popstate',function(){
    if(!viewer||viewer.hidden||!viewerHistoryArmed)return;
    viewerHistoryArmed=false;
    closeViewer();
  });

  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&viewer&&!viewer.hidden){
      event.preventDefault();
      goHome();
    }
  });
})();
