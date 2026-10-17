import {db,order,transition} from './db.js';
import {buySupplier,readListing} from './supplier.js';
import {encryptDelivery} from './core.js';
export async function fulfill(id){
  const record=await order(id);
  if(!record)throw new Error('Order not found');
  if(record.status==='fulfilled')return {status:'fulfilled',replayed:true};
  // Only an already claimed row may be purchased. Admin transitions
  // awaiting_payment/needs_review -> fulfilling using CAS. Concurrent requests
  // cannot start a second purchase, and supplier UUID prevents double charges.
  if(record.status!=='fulfilling')throw new Error('Order has not been claimed for fulfilment');
  try{
    const item=await db('store_products',{query:`id=eq.${record.product_id}&select=*`});
    const product=item[0];
    if(!product)throw new Error('Product no longer exists');
    const latest=await readListing(product.slug);
    if(latest.provider_listing_id!==product.provider_listing_id)throw new Error('Supplier listing changed');
    if(latest.stock<record.quantity)throw new Error('Supplier stock insufficient');
    if(latest.supplier_price_cents>record.supplier_unit_price_cents)throw new Error('Supplier price increased after invoice; review margins');
    const response=await buySupplier(product,record.quantity,record.id);
    if(response.accounts.length!==record.quantity)throw new Error('Supplier delivered unexpected quantity');
    await transition(id,'fulfilling','fulfilled',{supplier_order_id:String(response.order_id),delivery_ciphertext:encryptDelivery(response.accounts),error_message:null});
    return {status:'fulfilled'};
  }catch(error){
    await transition(id,'fulfilling','needs_review',{error_message:String(error.message||error).slice(0,180)});
    return {status:'needs_review',error:'Order requires manual review; do not automatically re-purchase'};
  }
}
