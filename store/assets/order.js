const $=s=>document.querySelector(s);const en=!(navigator.language||'ru').toLowerCase().startsWith('ru');const txt={ru:{back:'Мои заказы',label:'ВАШ ЗАКАЗ',title:'Отслеживание заказа',description:'История заказа, оплата и выдача товара.',loading:'Загружаем заказ…',status:'Статус',total:'Сумма',product:'Товар',amount:'Количество',network:'Сеть',created:'Создан',payment:'РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ',payHelp:'Переводите только USDT в сети TRC20. Переведите точную сумму USDT TRC20 в течение 50 минут. После перевода вставьте TXID для проверки блокчейна.',copyWallet:'Копировать адрес',refresh:'Обновить статус',delivery:'ВАШ ТОВАР',copyDelivery:'Копировать данные',awaiting_payment:'Ожидает оплаты',fulfilling:'В обработке',needs_review:'Требует проверки',fulfilled:'Выдан',cancelled:'Отменён',missing:'Недействительная ссылка заказа',failed:'Не удалось загрузить заказ',copied:'Скопировано',exactAmount:'Точная сумма к переводу',txLabel:'TXID транзакции TRON (64 символа)',verify:'Проверить оплату',checking:'Проверяем транзакцию…',timeLeft:'На оплату осталось',cancelOrder:'Отменить заказ',cancelConfirm:'Отменить неоплаченный заказ?',cancelling:'Отменяем заказ…',expiryNote:'Через 50 минут после создания неоплаченный заказ отменяется автоматически.',expired:'Время оплаты истекло. Заказ отменён.',timelyTransfer:'Если вы уже перевели деньги до окончания таймера, укажите TXID для подтверждения.'},en:{back:'My orders',label:'YOUR ORDER',title:'Track your order',description:'Order details, payment and delivery.',loading:'Loading order…',status:'Status',total:'Total',product:'Product',amount:'Quantity',network:'Network',created:'Created',payment:'PAYMENT DETAILS',payHelp:'Send USDT on TRC20 only. Send the exact USDT TRC20 amount within 50 minutes, then paste your TRON TXID for on-chain verification.',copyWallet:'Copy address',refresh:'Refresh status',delivery:'YOUR DELIVERY',copyDelivery:'Copy delivery',awaiting_payment:'Awaiting payment',fulfilling:'Processing',needs_review:'Under review',fulfilled:'Delivered',cancelled:'Cancelled',missing:'Invalid order link',failed:'Unable to load the order',copied:'Copied',exactAmount:'Exact transfer amount',txLabel:'TRON transaction TXID (64 characters)',verify:'Verify payment',checking:'Checking transaction…',timeLeft:'Time left to pay',cancelOrder:'Cancel order',cancelConfirm:'Cancel this unpaid order?',cancelling:'Cancelling order…',expiryNote:'Unpaid orders are cancelled automatically 50 minutes after creation.',expired:'Payment time has expired. Order cancelled.',timelyTransfer:'If you sent the transfer before the timer ended, enter its TXID to verify payment.'}};const tr=k=>txt[en?'en':'ru'][k]||k;document.documentElement.lang=en?'en':'ru';for(const e of document.querySelectorAll('[data-l]'))e.textContent=tr(e.dataset.l);const parsed=new URLSearchParams(location.hash.slice(1));const id=parsed.get('id'),token=parsed.get('token');const initData=()=>window.LHStoreAuth?.read()||'';if(!initData())$('#order-account-link').href='/store';let receipt,clockAnchor=0,serverAnchor=0,requestVersion=0,busyAction=false,expiryRequested=false;
function copy(s){navigator.clipboard.writeText(s).then(()=>{const el=$('#order-loading');el.hidden=false;el.textContent=tr('copied');setTimeout(()=>el.hidden=true,1300)}).catch(()=>{})}
$('#refresh-order').onclick=()=>load();
$('#copy-wallet').onclick=()=>copy(receipt?.wallet||'');
$('#copy-delivery').onclick=()=>copy((receipt?.items||[]).join('\n'));
const credentials=()=>({id,token,initData:initData()||undefined});
async function request(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||tr('failed'));return data;}
function tick(){
  if(!receipt)return;
  const awaiting=receipt.status==='awaiting_payment';
  const remaining=Date.parse(receipt.expiresAt)-(serverAnchor+performance.now()-clockAnchor);
  const ended=awaiting&&remaining<=0;
  const seconds=Math.max(0,Math.ceil(remaining/1000));
  $('#payment-countdown').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  $('#payment-window').hidden=!awaiting&&!receipt.timedOut;
  $('#payment-window-note').textContent=ended||receipt.timedOut?tr('expired'):tr('expiryNote');
  $('#payment-instructions').hidden=!awaiting||ended;
  $('#copy-wallet').hidden=!awaiting||ended;
  $('#cancel-order').hidden=!awaiting||ended;
  $('#cancel-order').disabled=busyAction;
  $('#verify-payment-form').hidden=!awaiting&&!receipt.timedOut;
  $('#verify-payment-form button').disabled=busyAction;
  $('#payment-section').hidden=!awaiting&&!receipt.timedOut;
  if(ended||receipt.timedOut)$('#payment-section [data-l="payHelp"]').textContent=tr('timelyTransfer');
  else $('#payment-section [data-l="payHelp"]').textContent=tr('payHelp');
  if(ended&&!expiryRequested&&!busyAction){expiryRequested=true;load(true);}
}
function render(data){
  receipt=data;clockAnchor=performance.now();serverAnchor=Number.isFinite(data.serverNow)?data.serverNow:Date.now();expiryRequested=false;
  $('#order-data').hidden=false;
  $('#ord-status').textContent=tr(data.status);$('#ord-status').className='status-mark '+data.status;
  $('#ord-total').textContent=Number(data.total).toFixed(2)+' USDT';
  $('#ord-pay-amount').textContent=(data.payAmount||'—')+' USDT';
  $('#ord-product').textContent=data.title;$('#ord-amount').textContent=data.quantity;$('#ord-network').textContent=data.network;
  $('#ord-date').textContent=new Date(data.createdAt).toLocaleString(en?'en-US':'ru-RU');$('#ord-wallet').textContent=data.wallet;
  $('#delivery-section').hidden=!Array.isArray(data.items);$('#ord-delivery').textContent=Array.isArray(data.items)?data.items.join('\n'):'';
  tick();
}
async function load(silent=false){
  if(!id||(!token&&!initData())){$('#order-loading').hidden=true;$('#order-error').textContent=tr('missing');$('#order-error').hidden=false;return;}
  const version=++requestVersion;
  if(!silent){$('#order-error').hidden=true;$('#order-loading').hidden=false;$('#order-loading').textContent=tr('loading');}
  try{const data=await request('/api/store/order',credentials());if(version===requestVersion)render(data);}
  catch(error){if(version===requestVersion){$('#order-error').textContent=error.message||tr('failed');$('#order-error').hidden=false;}}
  finally{if(version===requestVersion)$('#order-loading').hidden=true;}
}
$('#cancel-order').addEventListener('click',async()=>{
  if(busyAction||receipt?.status!=='awaiting_payment'||!confirm(tr('cancelConfirm')))return;
  busyAction=true;++requestVersion;tick();$('#verify-result').textContent=tr('cancelling');
  try{const data=await request('/api/store/order',{...credentials(),action:'cancel'});render(data);$('#verify-result').textContent='';}
  catch(error){$('#order-error').textContent=error.message||tr('failed');$('#order-error').hidden=false;await load(true);}
  finally{busyAction=false;tick();}
});
$('#verify-payment-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busyAction)return;
  const txHash=$('#payment-txid').value.trim();if(!/^[a-fA-F0-9]{64}$/.test(txHash))return;
  busyAction=true;++requestVersion;tick();const note=$('#verify-result');note.textContent=tr('checking');
  try{const data=await request('/api/store/verify-payment',{...credentials(),txHash});note.textContent=data.message||tr(data.status);await load(true);}
  catch(error){note.textContent=error.message||tr('failed');}
  finally{busyAction=false;tick();}
});
setInterval(tick,1000);
setInterval(()=>{if(!document.hidden&&!busyAction&&receipt&&['awaiting_payment','fulfilling'].includes(receipt.status))load(true);},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busyAction)load(true);});
async function initialLoad(){if(id&&token&&initData()){try{await window.LHStoreAuth.api('claim',{id,token})}catch{ /* Old receipt URL remains valid even when claim fails. */ }}await load();}
initialLoad();
