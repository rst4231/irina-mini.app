import {db,hasDb,order,settings,setSetting,transition} from '../../lib/store/db.js';
import {basicAuth,currency,guardMethod,json,sellPrice,validWallet} from '../../lib/store/core.js';
import {fulfill} from '../../lib/store/fulfill.js';
import {getFacebookCategory,hasSupplier,syncBatch} from '../../lib/store/supplier.js';

export default async function handler(req,res){
  if(!guardMethod(req,res,['GET','POST']))return;
  if(!basicAuth(req))return json(res,401,{error:'Invalid administrator token'});
  if(!hasDb())return json(res,503,{error:'Supabase is not configured'});
  try{
    if(req.method==='GET'){
      const cfg=await settings();
      const [products,orders]=await Promise.all([
        db('store_products',{query:'select=id,title,category,description,stock,supplier_price_cents,published,last_synced_at&order=last_synced_at.desc&limit=400'}),
        db('store_orders',{query:'select=id,product_title,customer_email,quantity,total_cents,status,created_at,supplier_order_id,error_message,payment_tx_hash&order=created_at.desc&limit=100'})
      ]);
      return json(res,200,{config:{markup_pct:cfg.markup_pct??45,checkout_enabled:cfg.checkout_enabled??false,supplier_resale_approved:cfg.supplier_resale_approved??false,usdt_trc20_wallet:cfg.usdt_trc20_wallet??'',sync_cursor:cfg.sync_cursor??null,supplier_connected:hasSupplier()},products:products.map(p=>({...p,price:currency(sellPrice(p.supplier_price_cents,Number(cfg.markup_pct??45)))})),orders:orders.map(x=>({...x,total:currency(x.total_cents)}))});
    }
    const {action}=req.body||{};
    if(action==='settings'){
      const markup=Number(req.body.markup_pct);
      const wallet=String(req.body.usdt_trc20_wallet||'').trim();
      const enabled=req.body.checkout_enabled===true;
      const approval=req.body.supplier_resale_approved===true;
      if(!Number.isInteger(markup)||markup<0||markup>500)return json(res,400,{error:'Наценка должна быть от 0 до 500%'});
      if(wallet && !validWallet(wallet))return json(res,400,{error:'Неверный адрес USDT TRC20'});
      if(enabled && (!wallet||!hasSupplier()||!approval||!process.env.STORE_DELIVERY_ENCRYPTION_KEY))return json(res,400,{error:'Для продаж требуются кошелёк, API, ключ шифрования и подтверждённое право перепродажи'});
      await setSetting('markup_pct',markup);
      await setSetting('usdt_trc20_wallet',wallet);
      await setSetting('supplier_resale_approved',approval);
      await setSetting('checkout_enabled',enabled);
      return json(res,200,{ok:true});
    }
    if(action==='publish'){
      const id=Number(req.body.id);
      if(!Number.isSafeInteger(id)||id<1||typeof req.body.published!=='boolean')return json(res,400,{error:'Invalid product'});
      await db('store_products',{method:'PATCH',query:`id=eq.${id}`,body:{published:req.body.published}});
      return json(res,200,{ok:true});
    }
    if(action==='sync'){
      if(!hasSupplier())return json(res,400,{error:'Нет STORE_ACCSZONE_API_KEY'});
      const cfg=await settings();
      let cursor=cfg.sync_cursor;
      let categoryId=cursor?.categoryId;
      if(!categoryId){const category=await getFacebookCategory();categoryId=category.id;cursor={categoryId,page:1};}
      const result=await syncBatch(categoryId,cursor.page,8);
      if(result.items.length)await db('rpc/store_sync_products',{method:'POST',body:{payload:result.items}});
      await setSetting('sync_cursor',result.nextPage?{categoryId,page:result.nextPage}:null);
      return json(res,200,{ok:true,count:result.items.length,more:!!result.nextPage});
    }
    if(action==='paid'){
      const id=String(req.body.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Invalid order'});
      // Human must confirm transaction on-chain before pressing the paid action.
      const tx=String(req.body.tx_hash||'').trim().toLowerCase();
      if(!/^[a-f0-9]{64}$/.test(tx))return json(res,400,{error:'Укажите 64-значный TX hash USDT TRC20 после проверки суммы, сети, адреса и подтверждений'});
      const claimed=await transition(id,'awaiting_payment','fulfilling',{payment_tx_hash:tx});
      if(!claimed)return json(res,409,{error:'Заказ уже обрабатывается или находится в другом статусе'});
      const result=await fulfill(id);
      return json(res,200,result);
    }
    if(action==='retry'){
      const id=String(req.body.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Invalid order'});
      const existing=await order(id);
      if(existing?.status!=='needs_review')return json(res,409,{error:'Only review orders may be retried'});
      const claimed=await transition(id,'needs_review','fulfilling');
      if(!claimed)return json(res,409,{error:'Order is already being processed'});
      const result=await fulfill(id);
      return json(res,200,result);
    }
    if(action==='cancel'){
      const id=String(req.body.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Invalid order'});
      const result=await transition(id,'awaiting_payment','cancelled');
      if(!result)return json(res,409,{error:'Cannot cancel after payment verification'});
      return json(res,200,{ok:true});
    }
    return json(res,400,{error:'Unknown operation'});
  }catch(error){console.error('Admin operation failed',error.message);return json(res,503,{error:'Не удалось выполнить операцию. Проверьте конфигурацию и логи.'});}
}
