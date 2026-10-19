import {randomInt,randomUUID} from 'node:crypto';
import {db,hasDb,product,settings} from '../../lib/store/db.js';
import {currency,json,guardMethod,newLookupToken,sha256,validEmail,storeCanCheckout} from '../../lib/store/core.js';
import {hasSupplier,readListing,supplier} from '../../lib/store/supplier.js';
import {quoteUsdCents,thbUsdRate,invoiceUnits,formatUsdt} from '../../lib/store/fx.js';
import {telegramUserFromInitData} from '../../lib/store/telegram.js';
export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Invalid origin'});}catch{return json(res,403,{error:'Invalid origin'});}}
  const {productId,quantity,email,honey='',locale='ru',initData}=req.body||{};
  if(!['ru','en'].includes(locale)||honey||!Number.isSafeInteger(productId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>20||!validEmail(email))return json(res,400,{error:'Invalid order'});
  if(initData!==undefined&&typeof initData!=='string')return json(res,400,{error:'Invalid Telegram credentials'});
  const tgUser=initData?telegramUserFromInitData(initData):null;
  if(initData&&!tgUser)return json(res,401,{error:'Telegram login expired. Open the store from the Mini App again.'});
  if(!hasDb()||!hasSupplier())return json(res,503,{error:'Checkout is not configured'});
  try{
    const config=await settings();
    if(!storeCanCheckout(config,hasSupplier()))return json(res,503,{error:'Payments are currently disabled'});
    const record=await product(productId);
    if(!record||record.provider!=='adsplus'||!record.published||!record.title_ru||!record.title_en||record.stock<quantity)return json(res,404,{error:'Product unavailable'});
    const latest=await readListing(record.provider_listing_id);
    if(latest.provider_listing_id!==record.provider_listing_id||latest.stock<quantity||quantity<latest.min_quantity||quantity>latest.max_quantity)return json(res,409,{error:'Supplier inventory changed'});
    // Fail closed before collecting buyer funds when the supplier account cannot cover this order.
    // ADSPLUS debits the separate THB wallet on purchase; buyers send USDT to the seller.
    const funds=await supplier('balance');
    const available=Number(funds?.balance);
    if(funds?.currency!=='THB'||!Number.isFinite(available)||available<0)return json(res,503,{error:'Не удалось проверить баланс поставщика. Повторите попытку позже.'});
    if(Math.round(available*100)<latest.supplier_price_cents*quantity)return json(res,409,{error:'Товар временно недоступен для автоматической выдачи. Баланс поставщика пополняется.'});
    const rate=await thbUsdRate();
    const unit=quoteUsdCents(latest.supplier_price_cents,Number(config.markup_pct??45),rate);
    const id=randomUUID(),token=newLookupToken();
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const ipHash=sha256(`${process.env.STORE_ADMIN_TOKEN}:${ip}`);
    const hourAgo=new Date(Date.now()-3600000).toISOString();
    const recent=await db('store_orders',{query:`select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(hourAgo)}&limit=6`});
    if(recent.length>=5)return json(res,429,{error:'Too many orders'});
    if(tgUser)await db('rpc/store_upsert_user',{method:'POST',body:tgUser});
    const base={id,lookup_hash:sha256(token),customer_email:email.trim().toLowerCase(),product_id:record.id,product_title:locale==='en'?record.title_en:record.title_ru,quantity,unit_price_cents:unit,supplier_unit_price_cents:latest.supplier_price_cents,total_cents:unit*quantity,pay_network:'TRC20',pay_wallet:config.usdt_trc20_wallet,status:'awaiting_payment',ip_hash:ipHash,...(tgUser?{telegram_user_id:tgUser.telegram_id}:{})};
    let units;
    for(let attempt=0;attempt<5;attempt++){
      units=invoiceUnits(base.total_cents,randomInt(1,10000));
      try{await db('store_orders',{method:'POST',body:{...base,pay_amount_micro:units}});break;}
      catch(error){if(!/409/.test(String(error.message))||attempt===4)throw error;}
    }
    return json(res,201,{id,token,status:'awaiting_payment',total:currency(base.total_cents),payAmount:formatUsdt(units),currency:'USDT',network:'TRC20',wallet:base.pay_wallet,notice:'Переведите точную сумму, включая 6 знаков после запятой. Проверка транзакции автоматическая.'});
  }catch(error){console.error('Create store order failed',error.message);return json(res,503,{error:'Order creation unavailable'});}
}
