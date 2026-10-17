import {db,hasDb,settings} from '../../lib/store/db.js';
import {demoItems} from '../../lib/store/demo.js';
import {currency,json,guardMethod,sellPrice} from '../../lib/store/core.js';
import {hasSupplier} from '../../lib/store/supplier.js';

export default async function handler(req,res){
  if(!guardMethod(req,res,['GET']))return;
  try{
    if(!hasDb())return json(res,200,{demo:true,checkout:false,products:demoItems,reason:'Database not connected'});
    const config=await settings();
    const all=await db('store_products',{query:'published=eq.true&select=id,title,category,description,stock,supplier_price_cents&order=title.asc&limit=250'});
    const markup=Number(config.markup_pct??45);
    const checkout=Boolean(config.checkout_enabled && config.supplier_resale_approved && config.usdt_trc20_wallet && hasSupplier());
    const products=all.map(p=>({id:p.id,title:p.title,category:p.category,description:p.description,stock:p.stock,price:currency(sellPrice(p.supplier_price_cents,markup)),demo:false,tags:[p.category]}));
    return json(res,200,{demo:false,checkout,products,reason:checkout?'':'Checkout is not activated'});
  }catch(error){console.error('Catalog read failed',error.message);return json(res,503,{error:'Каталог временно недоступен / Catalog unavailable'});}
}
