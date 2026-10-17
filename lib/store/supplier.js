import {moneyToCents,stripHtml,cleanTitle} from './core.js';
const API_ROOT='https://accszone.com/api/v1';
export const hasSupplier = () => !!process.env.STORE_ACCSZONE_API_KEY;
export async function supplier(path,{method='GET',body}={}){
  if(!hasSupplier())throw new Error('Supplier key is not configured');
  const result=await fetch(`${API_ROOT}${path}`,{method,headers:{'X-API-Key':process.env.STORE_ACCSZONE_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),cache:'no-store'});
  const data=await result.json().catch(()=>null);
  if(!result.ok||!data?.success){const error=new Error(data?.error_code||`supplier_http_${result.status}`);error.status=result.status;throw error;}
  return data;
}
export async function getFacebookCategory(){
  for(let page=1;page<=10;page++){
    const result=await supplier(`/categories?page=${page}`);
    const match=result.data?.find(x=>/facebook/i.test(x.title));
    if(match)return match;
    if(page>=(result.meta?.last_page||1))break;
  }
  throw new Error('Facebook category was not found');
}
export const normalizeListing = record => ({
  provider:'accszone', provider_listing_id:Number(record.id), slug:String(record.slug),
  title:cleanTitle(record.title), category:cleanTitle(record.category?.title||'Facebook'),
  description:stripHtml(record.description),supplier_price_cents:moneyToCents(record.price),
  stock:Math.max(0,Math.floor(Number(record.available_stock)||0)),last_synced_at:new Date().toISOString()
});
export async function readListing(slug){
  const response=await supplier(`/listings/${encodeURIComponent(slug)}`);
  return normalizeListing(response.data);
}
export async function syncBatch(categoryId,page=1,pages=8) {
  const items=[];let nextPage=page;
  for(let i=0;i<pages;i++){
    const response=await supplier(`/listings?category_id=${categoryId}&include=description&page=${nextPage}`);
    items.push(...response.data.map(normalizeListing));
    if(nextPage >= (response.meta?.last_page||nextPage))return {items,nextPage:null};
    nextPage++;
  }
  return {items,nextPage};
}
export async function buySupplier(product,quantity,clientReference){
  const response=await supplier('/purchase',{method:'POST',body:{ad_id:product.provider_listing_id,quantity,client_reference:clientReference}});
  if(!Array.isArray(response.data?.accounts))throw new Error('Malformed supplier delivery');
  return response.data;
}
