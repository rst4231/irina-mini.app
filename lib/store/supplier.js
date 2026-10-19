import {moneyToCents,stripHtml,cleanTitle} from './core.js';

// ADSPLUS v3: documented account catalog and purchase endpoint, server-side only.
const API_ROOT='https://adsplusth.com/en/accounts/api/v3';
export const hasSupplier=()=>/^adp_[a-zA-Z0-9]{20,}$/.test(process.env.STORE_ADSPLUS_API_KEY||'');
export async function supplier(action, body={}) {
  if(!/^(categories|products|buy|orders|order|balance)$/.test(action))throw new Error('Unknown supplier operation');
  if(!hasSupplier())throw new Error('ADSPLUS API key is not configured');
  const response=await fetch(`${API_ROOT}/${action}`,{
    method:'POST',headers:{'X-Api-Key':process.env.STORE_ADSPLUS_API_KEY,'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(16000)
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok!==true){
    const err=new Error(String(payload?.error?.code||`ADSPLUS_HTTP_${response.status}`).slice(0,60));err.status=response.status;throw err;
  }
  return payload.data;
}
const META_CATEGORY=/(?:\bfacebook\b|\binstagram\b|\bmeta\b|\bthreads\b|\bwhatsapp\b|\bbusiness manager\b|\bfb accounts?\b)/i;
const NON_ACCOUNT=/(?:\b(?:followers?|likes?|views?|comments?|boosts?|reactions?|services?|engagement)\b)/i;
export function isMetaAccountCategory(category){return META_CATEGORY.test(String(category||''))&&!NON_ACCOUNT.test(String(category||''));}
export async function getMetaCategories(){
  const data=await supplier('categories');
  const rows=Array.isArray(data?.categories)?data.categories:[];
  return rows.filter(x=>isMetaAccountCategory(x.name)&&Number.isSafeInteger(Number(x.category)))
    .map(x=>({id:Number(x.category),title:cleanTitle(x.name)}));
}
export function normalizeListing(record){
  const id=Number(record.product);
  const price=moneyToCents(record.price); // THB cents, NOT USD cents.
  if(record.currency!=='THB'||!Number.isSafeInteger(id)||id<1||!isMetaAccountCategory(record.category))throw new Error('Unsupported supplier account');
  const stock=Number(record.stock);
  const min=Number(record.min??1),max=Number(record.max??20);
  if(!Number.isSafeInteger(stock)||stock<0||!Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min)throw new Error('Invalid supplier limits');
  return {provider:'adsplus',provider_listing_id:id,slug:String(id),title:cleanTitle(record.name),category:cleanTitle(record.category),description:`Meta · ${cleanTitle(record.category)} · ${Math.min(20,max)} max.`,supplier_price_cents:price,stock,min_quantity:min,max_quantity:max,last_synced_at:new Date().toISOString()};
}
export async function readListing(productId){
  const id=Number(productId);
  if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid supplier ID');
  const data=await supplier('products',{q:String(id),page:1});
  const match=(data?.products||[]).find(p=>Number(p.product)===id);
  if(!match)throw new Error('Supplier product unavailable');
  return normalizeListing(match);
}
export async function syncBatch(categoryId,page=1,pages=6){
  const list=[];let nextPage=page;
  for(let i=0;i<pages;i++){
    const data=await supplier('products',{category:categoryId,page:nextPage});
    for(const item of data?.products||[]){if(isMetaAccountCategory(item.category))list.push(normalizeListing(item));}
    const last=Number(data?.pages||1);
    if(nextPage>=last)return {items:list,nextPage:null};
    nextPage++;
  }
  return {items:list,nextPage};
}
export async function buySupplier(product,quantity){
  const result=await supplier('buy',{product:Number(product.provider_listing_id),qty:quantity});
  if(!Array.isArray(result.accounts)||result.accounts.length!==quantity||!result.order)throw new Error('Supplier delivery incomplete: manual review required');
  return {order_id:String(result.order),accounts:result.accounts};
}
