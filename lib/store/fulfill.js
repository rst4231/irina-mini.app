import {db,order,transition} from './db.js';
import {buySupplier,readListing} from './supplier.js';
import {encryptDelivery} from './core.js';
// Never replay purchase after an uncertain network outcome. ADSPLUS /buy has no
// documented idempotency key. Persist purchase_started_at BEFORE calling it.
export async function fulfill(id){
  const record=await order(id);
  if(!record)throw new Error('Order not found');
  if(record.status==='fulfilled')return {status:'fulfilled',replayed:true};
  if(record.status!=='fulfilling')throw new Error('Order not claimed');
  if(record.purchase_started_at)return {status:'needs_review',error:'Purchase already attempted; reconcile ADSPLUS order history manually'};
  try{
    const product=(await db('store_products',{query:`id=eq.${record.product_id}&select=*`}))[0];
    if(!product||product.provider!=='adsplus')throw new Error('Product unavailable');
    const latest=await readListing(product.provider_listing_id);
    if(latest.provider_listing_id!==product.provider_listing_id||latest.stock<record.quantity)throw new Error('Supplier product or stock changed');
    if(record.quantity<latest.min_quantity||record.quantity>latest.max_quantity)throw new Error('Supplier quantity limit');
    if(latest.supplier_price_cents>record.supplier_unit_price_cents)throw new Error('Supplier price increased');
    const begin=await db('rpc/store_begin_purchase',{method:'POST',body:{id}});
    if(!begin?.[0]?.claimed)return {status:'needs_review',error:'Purchase attempt already recorded'};
    const result=await buySupplier(product,record.quantity);
    await transition(id,'fulfilling','fulfilled',{supplier_order_id:result.order_id,delivery_ciphertext:encryptDelivery(result.accounts),error_message:null});
    return {status:'fulfilled'};
  }catch(error){
    const message=String(error.message||error).slice(0,180);
    try{await transition(id,'fulfilling','needs_review',{error_message:message});}catch{}
    return {status:'needs_review',error:'Manual review required; purchase will not be retried automatically'};
  }
}
