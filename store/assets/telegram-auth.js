// Telegram Mini App credentials stay in this tab's session and are reverified on every API request.
(function(){
  const key='irina.telegram-init-data.v1';
  const maxAge=6*3600;
  function read(){
    const live=window.Telegram?.WebApp?.initData||'';
    let cached='';
    try{cached=window.sessionStorage.getItem(key)||'';}catch{}
    for(const value of [live,cached]){
      if(!value||value.length>8192)continue;
      const fields=new URLSearchParams(value);
      const authDate=Number(fields.get('auth_date'));
      if(!Number.isSafeInteger(authDate)||!fields.get('hash')||Math.floor(Date.now()/1000)-authDate>maxAge||Math.floor(Date.now()/1000)-authDate< -60)continue;
      if(value===live){try{window.sessionStorage.setItem(key,value);}catch{}}
      return value;
    }
    return '';
  }
  async function api(action,extra={}){
    const initData=read();
    if(!initData)throw Error('Откройте LH STORE через Telegram Mini App');
    const response=await fetch('/api/store/account',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({initData,action,...extra})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Личный кабинет недоступен');
    return result;
  }
  // Prevent accidental pinch/double-tap zoom only inside Telegram Mini App.
  if(read()){
    const viewport=document.querySelector('meta[name="viewport"]');
    if(viewport)viewport.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    document.documentElement.classList.add('tg-store-no-zoom');
    for(const name of ['gesturestart','gesturechange','gestureend']){
      document.addEventListener(name,event=>event.preventDefault(),{passive:false});
    }
    document.addEventListener('touchmove',event=>{
      if(event.touches?.length>1)event.preventDefault();
    },{passive:false});
    document.addEventListener('wheel',event=>{
      if(event.ctrlKey)event.preventDefault();
    },{passive:false});
  }
  window.LHStoreAuth={read,api,available:()=>Boolean(read())};
})();
