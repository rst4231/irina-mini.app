import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleRequest} from '../cloudflare/irina-store-d1-worker.js';

const SECRET='the-internal-store-worker-token-is-long-enough';
const UUID='ba3e4b7d-9b7a-4c76-8fae-a9864237e011';
function makeEnv(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');db.exec(readFileSync(new URL('../store/schema-d1.sql',import.meta.url),'utf8'));
  const backend={
    prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {all(){return {results:statement.all(...args)}},run(){return statement.run(...args)}}}}},
    async batch(commands){return commands.map(c=>c.run())}
  };
  return {STORE_D1_TOKEN:SECRET,STORE_DB:backend,db};
}
async function rpc(env,table,method='GET',query='',body={},authorization=SECRET){
  const req=new Request('https://store-worker.example/internal',{method:'POST',headers:{Authorization:`Bearer ${authorization}`,'Content-Type':'application/json'},body:JSON.stringify({table,method,query,body})});
  const res=await handleRequest(req,env);return {status:res.status,body:await res.json()};
}
const listing={provider:'adsplus',provider_listing_id:123,slug:'safe',title:'Facebook personal account',category:'Facebook Accounts',description:'Test inventory only',supplier_price_cents:600,stock:3};
test('admin order list joins the correct Telegram name and username without exposing delivery secrets',async()=>{
  const env=makeEnv();await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]});
  await rpc(env,'rpc/store_upsert_user','POST','',{telegram_id:'12345',first_name:'Рустам',username:'test_user'});
  await rpc(env,'rpc/store_upsert_user','POST','',{telegram_id:'67890',first_name:'Другой',username:'other_user'});
  await rpc(env,'store_orders','POST','',{...orderBody(UUID),telegram_user_id:'12345'});
  const legacy='ca3e4b7d-9b7a-4c76-8fae-a9864237e011';
  await rpc(env,'store_orders','POST','',{...orderBody(legacy),pay_amount_micro:9000002});
  const result=await rpc(env,'rpc/store_admin_orders');
  assert.equal(result.status,200);
  assert.equal(result.body.length,2);
  const linked=result.body.find(x=>x.id===UUID),unlinked=result.body.find(x=>x.id===legacy);
  assert.equal(linked.telegram_first_name,'Рустам');assert.equal(linked.telegram_username,'test_user');
  assert.equal(unlinked.telegram_first_name,null);assert.equal(unlinked.telegram_username,null);
  for(const row of result.body){assert.equal(Object.hasOwn(row,'delivery_ciphertext'),false);assert.equal(Object.hasOwn(row,'lookup_hash'),false);}
  assert.equal((await rpc(env,'rpc/store_admin_orders','GET','',{},'invalid')).status,401);
  assert.equal((await rpc(env,'rpc/store_admin_orders','GET','select=delivery_ciphertext')).status,400);
  env.db.close();
});
function orderBody(id){return {id,lookup_hash:'hash'+id,customer_email:'test@example.com',product_id:1,product_title:'Facebook personal account',quantity:1,unit_price_cents:900,supplier_unit_price_cents:600,total_cents:900,pay_network:'TRC20',pay_wallet:'TLEYJyCMjPjNXy3jFiyAfwTwXvgRuQY4VW',status:'awaiting_payment',ip_hash:'abc',pay_amount_micro:9000001};}
test('private worker rejects unauthenticated, public GET and arbitrary SQL',async()=>{
  const env=makeEnv();
  assert.equal((await rpc(env,'store_settings','GET','',{},'invalid')).status,401);
  assert.equal((await rpc({...env,STORE_D1_TOKEN:undefined},'store_settings')).status,401);
  assert.equal((await handleRequest(new Request('https://store-worker.example/internal'),env)).status,404);
  assert.equal((await rpc(env,'sqlite_master')).status,400);
  assert.equal((await rpc(env,'store_orders','GET','select=private_field')).status,400);
  assert.equal((await rpc(env,'store_orders','GET','id=eq.x%27+OR+1%3D1--')).body.length,0);
  env.db.close();
});
test('D1 settings read and write JSON with safe types',async()=>{
  const env=makeEnv();
  let a=await rpc(env,'store_settings');assert.equal(a.body.length,6);assert.equal(a.body.find(x=>x.key==='checkout_enabled').value,false);
  a=await rpc(env,'store_settings','POST','',{key:'markup_pct',value:39});assert.equal(a.status,200);
  assert.equal((await rpc(env,'store_settings')).body.find(x=>x.key==='markup_pct').value,39);
  assert.equal((await rpc(env,'store_settings','POST','',{key:'admin_token',value:'LEAK'})).status,400);
  env.db.close();
});
test('supplier sync remains unpublished and update preserves reviewed publication',async()=>{
  const env=makeEnv();
  let a=await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]});assert.equal(a.status,200);
  a=await rpc(env,'store_products','GET','published=eq.true&select=id,title');assert.deepEqual(a.body,[]);
  a=await rpc(env,'store_products','PATCH','id=eq.1',{published:true});assert.equal(a.status,200);
  a=await rpc(env,'rpc/store_sync_products','POST','',{payload:[{...listing,stock:2,supplier_price_cents:650}]});assert.equal(a.status,200);
  a=await rpc(env,'store_products','GET','id=eq.1&select=id,published,stock,supplier_price_cents');assert.deepEqual(a.body,[{id:1,published:true,stock:2,supplier_price_cents:650}]);
  env.db.close();
});
test('order CAS and unique TRC20 transaction prevent double fulfilment',async()=>{
  const env=makeEnv();await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]});
  assert.equal((await rpc(env,'store_orders','POST','',orderBody(UUID))).status,200);
  const tx='a'.repeat(64);
  let a=await rpc(env,'store_orders','PATCH',`id=eq.${UUID}&status=eq.awaiting_payment`,{status:'fulfilling',payment_tx_hash:tx});
  assert.equal(a.body[0].status,'fulfilling');
  a=await rpc(env,'store_orders','PATCH',`id=eq.${UUID}&status=eq.awaiting_payment`,{status:'fulfilling',payment_tx_hash:tx});assert.deepEqual(a.body,[]);
  a=await rpc(env,'store_orders','PATCH',`id=eq.${UUID}&status=eq.fulfilling`,{status:'fulfilled',supplier_order_id:'supplier-42',delivery_ciphertext:'encrypted'});assert.equal(a.body[0].status,'fulfilled');
  assert.equal((await rpc(env,'store_orders','PATCH',`id=eq.${UUID}&status=eq.fulfilled`,{status:'awaiting_payment'})).status,400);
  assert.equal((await rpc(env,'store_orders','GET',`id=eq.${UUID}&select=status,payment_tx_hash,delivery_ciphertext`)).body[0].delivery_ciphertext,'encrypted');
  env.db.close();
});
test('reusing paid TX hash for another order is a conflict, and all inputs are bound',async()=>{
  const env=makeEnv();await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]});
  const id2='ca3e4b7d-9b7a-4c76-8fae-a9864237e011';
  await rpc(env,'store_orders','POST','',orderBody(UUID));await rpc(env,'store_orders','POST','',{...orderBody(id2),pay_amount_micro:9000002});
  const tx='b'.repeat(64);
  assert.equal((await rpc(env,'store_orders','PATCH',`id=eq.${UUID}&status=eq.awaiting_payment`,{status:'fulfilling',payment_tx_hash:tx})).status,200);
  assert.equal((await rpc(env,'store_orders','PATCH',`id=eq.${id2}&status=eq.awaiting_payment`,{status:'fulfilling',payment_tx_hash:tx})).status,409);
  env.db.close();
});

test('Meta personal accounts are eligible for draft sync; unrelated goods are rejected',async()=>{
  const env=makeEnv();
  assert.equal((await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]})).status,200);
  assert.equal((await rpc(env,'store_products','GET','select=id,category,published')).body[0].published,false);
  assert.equal((await rpc(env,'rpc/store_sync_products','POST','',{payload:[{...listing,provider_listing_id:124,category:'Gmail Accounts'}]})).status,400);
  assert.equal((await rpc(env,'rpc/store_sync_products','POST','',{payload:[{...listing,provider_listing_id:125,category:'Instagram Followers Service'}]})).status,400);
  env.db.close();
});

test('purchase claim is durable, atomic, one attempt only',async()=>{
  const env=makeEnv();await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]});
  assert.equal((await rpc(env,'store_orders','POST','',orderBody(UUID))).status,200);
  assert.equal((await rpc(env,'store_orders','PATCH',`id=eq.${UUID}&status=eq.awaiting_payment`,{status:'fulfilling',payment_tx_hash:'f'.repeat(64)})).status,200);
  const first=await rpc(env,'rpc/store_begin_purchase','POST','',{id:UUID});assert.deepEqual(first.body,[{claimed:true}]);
  const second=await rpc(env,'rpc/store_begin_purchase','POST','',{id:UUID});assert.deepEqual(second.body,[{claimed:false}]);
  env.db.close();
});

test('localized titles survive stock refresh but reset if supplier text changes',async()=>{
  const env=makeEnv();
  await rpc(env,'rpc/store_sync_products','POST','',{payload:[listing]});
  env.db.prepare("UPDATE store_products SET title_ru='Аккаунт Facebook',title_en='Facebook account',category_ru='Facebook',category_en='Facebook' WHERE id=1").run();
  await rpc(env,'rpc/store_sync_products','POST','',{payload:[{...listing,stock:7}]});
  let result=await rpc(env,'store_products','GET','id=eq.1&select=title_ru,title_en,stock');
  assert.equal(result.body[0].title_ru,'Аккаунт Facebook');
  assert.equal(result.body[0].stock,7);
  await rpc(env,'rpc/store_sync_products','POST','',{payload:[{...listing,title:'Different supplier account'}]});
  result=await rpc(env,'store_products','GET','id=eq.1&select=title_ru,title_en,category_ru,translation_attempts');
  assert.equal(result.body[0].title_ru,null);
  assert.equal(result.body[0].title_en,null);
  assert.equal(result.body[0].translation_attempts,0);
  env.db.close();
});
