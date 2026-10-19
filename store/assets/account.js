const $=selector=>document.querySelector(selector);
const en=!(navigator.language||'ru').toLowerCase().startsWith('ru');
const t=en?{label:'ACCOUNT',title:'My orders',intro:'Your purchases and their status. Sign in with Telegram, no password.',loading:'Loading your orders…',empty:'No orders yet. Explore LH STORE catalog.',more:'Show more',catalog:'Catalog',notTelegram:'Open LH STORE from the Irina Telegram Mini App to view your orders.',failed:'Unable to load your orders',orders:'Orders',status:{awaiting_payment:'Awaiting payment',fulfilling:'Processing',needs_review:'Under review',fulfilled:'Delivered',cancelled:'Cancelled'}}:{label:'ЛИЧНЫЙ КАБИНЕТ',title:'Мои заказы',intro:'Ваши покупки и их текущие статусы. Вход через Telegram без пароля.',loading:'Загружаем заказы…',empty:'Пока нет заказов. Посмотрите каталог LH STORE.',more:'Показать ещё',catalog:'Каталог',notTelegram:'Откройте LH STORE через Telegram Mini App «Ирина», чтобы увидеть свои заказы.',failed:'Не удалось загрузить заказы',orders:'Заказы',status:{awaiting_payment:'Ожидает оплаты',fulfilling:'В обработке',needs_review:'Требует проверки',fulfilled:'Выдан',cancelled:'Отменён'}};
document.documentElement.lang=en?'en':'ru';
$('#account-label').textContent=t.label;$('#account-title').textContent=t.title;$('#account-intro').textContent=t.intro;$('#account-loading').textContent=t.loading;$('#account-empty').textContent=t.empty;$('#account-more').textContent=t.more;$('#back-to-store').textContent='← '+t.catalog;
let page=0;let loading=false;let count=0;
function card(v){
  const a=document.createElement('a');a.className='account-order';a.href='/store/order#'+new URLSearchParams({id:v.id}).toString();
  const main=document.createElement('div');main.className='account-order-main';
  const title=document.createElement('strong');title.textContent=v.title;
  const date=document.createElement('small');date.textContent=new Date(v.createdAt).toLocaleString(en?'en-US':'ru-RU');
  const details=document.createElement('small');details.textContent=v.quantity+' × · '+Number(v.total).toFixed(2)+' USDT';
  main.append(title,date,details);
  const status=document.createElement('span');status.className='status-mark '+v.status;status.textContent=t.status[v.status]||v.status;
  a.append(main,status);return a;
}
async function load(){
  if(loading)return;loading=true;$('#account-more').disabled=true;
  $('#account-loading').hidden=page!==0;$('#account-error').hidden=true;
  try{
    const data=await window.LHStoreAuth.api('list',{page});
    $('#account-loading').hidden=true;
    if(data.user?.firstName||data.user?.username){$('#account-greeting').textContent=data.user.firstName||'@'+data.user.username;$('#account-greeting').hidden=false;}
    const orders=Array.isArray(data.orders)?data.orders:[];
    const list=$('#account-list');for(const order of orders)list.append(card(order));
    count+=orders.length;list.hidden=count===0;$('#account-empty').hidden=count!==0;
    $('#account-more').hidden=!data.hasMore;page++;
  }catch(error){$('#account-loading').hidden=true;$('#account-error').textContent=error.message||t.failed;$('#account-error').hidden=false;}
  finally{loading=false;$('#account-more').disabled=false;}
}
$('#account-more').addEventListener('click',load);
if(window.LHStoreAuth?.available())load();else{$('#account-loading').hidden=true;$('#account-error').textContent=t.notTelegram;$('#account-error').hidden=false;}
