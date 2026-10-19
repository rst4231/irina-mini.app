// Backend-only Cloudflare D1 adapter; the Worker holds the D1 binding.
export const hasDb=()=>!!(process.env.STORE_D1_URL && process.env.STORE_D1_TOKEN?.length>=32);
export async function db(table,{method='GET',query='',body,prefer}={}){
  if(!hasDb())throw new Error('Store Cloudflare D1 is not configured');
  const url=new URL(process.env.STORE_D1_URL);
  if(url.protocol!=='https:')throw new Error('D1 endpoint must be HTTPS');
  const response=await fetch(url,{method:'POST',headers:{'Authorization':`Bearer ${process.env.STORE_D1_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({table,method,query,body,prefer}),signal:AbortSignal.timeout(12000),cache:'no-store'});
  const result=await response.json().catch(()=>null);
  if(!response.ok||!Array.isArray(result))throw new Error(`Store D1 error ${response.status}: ${result?.error||'unavailable'}`);
  return result;
}
export async function settings(){return Object.fromEntries((await db('store_settings',{query:'select=key,value'})).map(r=>[r.key,r.value]));}
export async function setSetting(key,value){await db('store_settings',{method:'POST',body:{key,value}});}
export async function product(id){return (await db('store_products',{query:`id=eq.${encodeURIComponent(id)}&select=*`}))?.[0]||null;}
export async function order(id){return (await db('store_orders',{query:`id=eq.${encodeURIComponent(id)}&select=*`}))?.[0]||null;}
export async function transition(id,from,to,extra={}){
  const found=await db('store_orders',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(from)}`,body:{status:to,...extra}});
  return found[0]||null;
}
