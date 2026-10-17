import {json} from './core.js';

export const hasDb = () => !!(process.env.STORE_SUPABASE_URL && process.env.STORE_SUPABASE_SERVICE_ROLE_KEY);
export async function db(table,{method='GET',query='',body,prefer}={}) {
  if(!hasDb()) throw new Error('Database is not configured');
  const url = new URL(`${process.env.STORE_SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}${query?`?${query}`:''}`);
  const response = await fetch(url,{method,headers:{'apikey':process.env.STORE_SUPABASE_SERVICE_ROLE_KEY,'Authorization':`Bearer ${process.env.STORE_SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json', ...(prefer?{'Prefer':prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000),cache:'no-store'});
  const value=await response.text();
  if(!response.ok) throw new Error(`Database ${response.status}: ${value.slice(0,250)}`);
  if(!value)return [];
  return JSON.parse(value);
}
export async function settings() {
  const values=await db('store_settings',{query:'select=key,value'});
  return Object.fromEntries(values.map(row=>[row.key,row.value]));
}
export async function setSetting(key,value) {
  await db('store_settings',{method:'POST',query:'on_conflict=key',prefer:'resolution=merge-duplicates,return=minimal',body:{key,value,updated_at:new Date().toISOString()}});
}
export async function product(id){
  const found=await db('store_products',{query:`id=eq.${encodeURIComponent(id)}&select=*`});
  return found[0]||null;
}
export async function order(id){
  const result=await db('store_orders',{query:`id=eq.${encodeURIComponent(id)}&select=*`});
  return result[0]||null;
}
export async function transition(id,from,to,extra={}){
  const result=await db('store_orders',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(from)}&select=*`,prefer:'return=representation',body:{status:to,updated_at:new Date().toISOString(),...extra}});
  return result[0]||null;
}
