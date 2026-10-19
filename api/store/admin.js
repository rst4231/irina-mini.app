import {db,hasDb,order,settings,setSetting,transition} from '../../lib/store/db.js';
import {basicAuth,currency,guardMethod,json,storeCanCheckout,validWallet} from '../../lib/store/core.js';
import {quoteUsdCents,formatUsdt,thbUsdRate} from '../../lib/store/fx.js';
import {fulfill} from '../../lib/store/fulfill.js';
import {getMetaCategories,hasSupplier,syncBatch,supplier} from '../../lib/store/supplier.js';
import {verifyTronPayment} from '../../lib/store/tron.js';
import {currentProfitMonth,profitReport,validProfitMonth} from '../../lib/store/profit.js';

export default async function handler(req,res){
  if(!guardMethod(req,res,['GET','POST']))return;
  if(!basicAuth(req))return json(res,401,{error:'Invalid administrator token'});
  if(!hasDb())return json(res,503,{error:'Cloudflare D1 is not configured'});
  try{
    if(req.method==='GET'){
      if(req.query?.report==='profit'){
        const month=req.query.month??currentProfitMonth();
        if(!validProfitMonth(month))return json(res,400,{error:'Выберите месяц в формате ГГГГ-ММ или all'});
        return json(res,200,{profit:await profitReport(month)});
      }
      const cfg=await settings();
      const [products,orders]=await Promise.all([
        db('store_products',{query:'select=id,provider,title,category,title_ru,title_en,category_ru,category_en,description,stock,supplier_price_cents,published,last_synced_at&order=last_synced_at.desc&limit=400'}),
        db('rpc/store_admin_orders')
      ]);
      let rate=null;
      try{rate=await thbUsdRate();}catch(error){console.error('FX rate unavailable',error.message);}
      let supplierBalance=null;
      if(hasSupplier()){
        try{const value=await supplier('balance');if(value?.currency==='THB'&&Number.isFinite(Number(value.balance)))supplierBalance=Number(value.balance);}
        catch(e){console.error('ADSPLUS balance unavailable',String(e.message).slice(0,80));}
      }
      const markup=Number(cfg.markup_pct??45);
      return json(res,200,{config:{markup_pct:markup,checkout_enabled:cfg.checkout_enabled??false,auto_fulfillment_enabled:cfg.auto_fulfillment_enabled??false,supplier_resale_approved:cfg.supplier_resale_approved??false,usdt_trc20_wallet:cfg.usdt_trc20_wallet??'',sync_cursor:cfg.sync_cursor??null,supplier_connected:hasSupplier(),supplier_balance_thb:supplierBalance,fx_connected:rate!==null,blockchain_connected:!!process.env.STORE_TRONSCAN_API_KEY},products:products.map(p=>({...p,price:rate!==null?currency(quoteUsdCents(p.supplier_price_cents,markup,rate)):null})),orders:orders.map(x=>({...x,total:currency(x.total_cents),payAmount:Number.isSafeInteger(x.pay_amount_micro)?formatUsdt(x.pay_amount_micro):null}))});
    }
    const {action}=req.body||{};
    if(action==='settings'){
      const markup=Number(req.body.markup_pct),wallet=String(req.body.usdt_trc20_wallet||'').trim();
      const enabled=req.body.checkout_enabled===true,approval=req.body.supplier_resale_approved===true,auto=req.body.auto_fulfillment_enabled===true;
      if(!Number.isInteger(markup)||markup<0||markup>500)return json(res,400,{error:'Наценка должна быть от 0 до 500%'});
      if(wallet&&!validWallet(wallet))return json(res,400,{error:'Неверный адрес USDT TRC20'});
      const proposed={checkout_enabled:enabled,supplier_resale_approved:approval,usdt_trc20_wallet:wallet};
      if(enabled&&!storeCanCheckout(proposed,hasSupplier()))return json(res,400,{error:'Для запуска нужны API ADSPLUS, D1, админ-токен, ключ шифрования, TRONSCAN API, кошелёк и подтверждение прав перепродажи'});
      if(auto&&(!enabled||process.env.STORE_ALLOW_AUTOFULFILL!=='true'))return json(res,400,{error:'Для автозакупки после проверки нужен отдельный флаг STORE_ALLOW_AUTOFULFILL=true и включённые продажи'});
      if(enabled)await thbUsdRate();
      await setSetting('markup_pct',markup);await setSetting('usdt_trc20_wallet',wallet);await setSetting('supplier_resale_approved',approval);await setSetting('checkout_enabled',enabled);await setSetting('auto_fulfillment_enabled',auto);
      return json(res,200,{ok:true});
    }
    if(action==='publish'){
      const id=Number(req.body.id);
      if(!Number.isSafeInteger(id)||id<1||typeof req.body.published!=='boolean')return json(res,400,{error:'Invalid product'});
      if(req.body.published===true&&(await settings()).supplier_resale_approved!==true)return json(res,403,{error:'Подтвердите право перепродажи'});
      await db('store_products',{method:'PATCH',query:`id=eq.${id}`,body:{published:req.body.published}});
      return json(res,200,{ok:true});
    }
    if(action==='sync'){
      if(!hasSupplier())return json(res,400,{error:'Отсутствует STORE_ADSPLUS_API_KEY'});
      const cfg=await settings();let cursor=cfg.sync_cursor;
      if(!cursor?.categories?.length){const categories=await getMetaCategories();if(!categories.length)return json(res,422,{error:'Поставщик не вернул категории аккаунтов Meta'});cursor={categories:categories.map(x=>x.id),index:0,page:1};}
      const categoryId=cursor.categories[cursor.index];
      if(!Number.isSafeInteger(categoryId))throw new Error('Invalid category cursor');
      const result=await syncBatch(categoryId,cursor.page,6);
      // Cloudflare D1 Worker accepts at most 200 listings per sync batch.
      for(let offset=0;offset<result.items.length;offset+=200){
        await db('rpc/store_sync_products',{method:'POST',body:{payload:result.items.slice(offset,offset+200)}});
      }
      const next=result.nextPage?{...cursor,page:result.nextPage}:cursor.index+1<cursor.categories.length?{...cursor,index:cursor.index+1,page:1}:null;
      await setSetting('sync_cursor',next);
      return json(res,200,{ok:true,count:result.items.length,more:!!next});
    }
    if(action==='paid'){
      const id=String(req.body.id||''),tx=String(req.body.tx_hash||'').trim().toLowerCase();
      if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/.test(tx))return json(res,400,{error:'Invalid order/payment'});
      const record=await order(id);
      if(!record||record.status!=='awaiting_payment'||!Number.isSafeInteger(record.pay_amount_micro))return json(res,409,{error:'Invalid order status'});
      const paid=await verifyTronPayment({txid:tx,wallet:record.pay_wallet,units:record.pay_amount_micro,createdAt:record.created_at});
      if(!paid)return json(res,422,{error:'Транзакция не подтверждена или не совпадают реквизиты'});
      const claimed=await transition(id,'awaiting_payment','fulfilling',{payment_tx_hash:tx});
      if(!claimed)return json(res,409,{error:'TXID already used or order already processing'});
      const cfg=await settings();
      if(cfg.auto_fulfillment_enabled!==true||process.env.STORE_ALLOW_AUTOFULFILL!=='true')return json(res,200,{status:'fulfilling',message:'Payment verified; awaits manual fulfillment'});
      return json(res,200,await fulfill(id));
    }
    if(action==='fulfill'){
      const id=String(req.body.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Invalid ID'});
      const record=await order(id);
      if(!record||record.status!=='fulfilling'||!record.payment_tx_hash)return json(res,409,{error:'Order is not awaiting fulfillment'});
      return json(res,200,await fulfill(id));
    }
    if(action==='cancel'){
      const id=String(req.body.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Invalid ID'});
      const updated=await transition(id,'awaiting_payment','cancelled');
      if(!updated)return json(res,409,{error:'Cannot cancel after payment verification'});
      return json(res,200,{ok:true});
    }
    return json(res,400,{error:'Unknown operation'});
  }catch(error){console.error('Store admin failed',String(error.message).slice(0,180));return json(res,503,{error:'Операция не удалась. Проверьте конфигурацию и логи.'});}
}
