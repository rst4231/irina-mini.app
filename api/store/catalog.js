import {db,hasDb,settings} from '../../lib/store/db.js';
import {demoItems} from '../../lib/store/demo.js';
import {currency,json,guardMethod,storeCanCheckout} from '../../lib/store/core.js';
import {hasSupplier} from '../../lib/store/supplier.js';
import {quoteUsdCents,thbUsdRate} from '../../lib/store/fx.js';
export default async function handler(req,res){
  if(!guardMethod(req,res,['GET']))return;
  try{
    if(!hasDb())return json(res,200,{demo:true,checkout:false,products:demoItems,reason:'Database not connected'});
    const [config,all]=await Promise.all([settings(),db('store_products',{query:'published=eq.true&select=id,provider,title_ru,title_en,category_ru,category_en,description,stock,supplier_price_cents&order=title.asc&limit=250'})]);
    // Untranslated supplier listings are kept private until both locales are ready.
    const catalog=all.filter(p=>p.provider==='adsplus'&&p.title_ru&&p.title_en&&p.category_ru&&p.category_en);
    if(!catalog.length)return json(res,200,{demo:false,checkout:false,products:[],reason:'The catalog has no approved products'});
    const rate=await thbUsdRate();
    const markup=Number(config.markup_pct??45);
    const checkout=storeCanCheckout(config,hasSupplier());
    const products=catalog.map(p=>({id:p.id,title:p.title_ru,titleEn:p.title_en,category:p.category_ru,categoryEn:p.category_en,description:p.description,stock:p.stock,price:currency(quoteUsdCents(p.supplier_price_cents,markup,rate)),demo:false,tags:[p.category]}));
    return json(res,200,{demo:false,checkout,products,reason:checkout?'':'Checkout is not activated'});
  }catch(error){console.error('Store catalog failed',error.message);return json(res,503,{error:'Каталог временно недоступен / Catalog unavailable'});}
}
