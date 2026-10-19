import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {telegramUserFromInitData} from '../lib/store/telegram.js';
import {handleRequest} from '../cloudflare/irina-store-d1-worker.js';
import accountHandler from '../api/store/account.js';
import receiptHandler from '../api/store/order.js';
import {sha256} from '../lib/store/core.js';

const bot='test-store-telegram-bot:abcdef';
function signed(user, date=Math.floor(Date.now()/1000)){
  const fields=new URLSearchParams({auth_date:String(date),query_id:'AAZZ01',user:JSON.stringify(user)});
  const data=[...fields].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const key=createHmac('sha256','WebAppData').update(bot).digest();
  fields.set('hash',createHmac('sha256',key).update(data).digest('hex'));
  return fields.toString();
}
function response(){return{statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
function invoke(handler,body){const res=response();return Promise.resolve(handler({method:'POST',headers:{host:'irina-miniapp.vercel.app'},body},res)).then(()=>res);}
test('Telegram HMAC checks identity, tampering and expiration',()=>{
  const init=signed({id:12345,first_name:'Test',username:'alice'});
  assert.equal(telegramUserFromInitData(init,{botToken:bot}).telegram_id,'12345');
  assert.equal(telegramUserFromInitData(init.replace('alice','bob'),{botToken:bot}),null);
  assert.equal(telegramUserFromInitData(signed({id:12345},Math.floor(Date.now()/1000)-90000),{botToken:bot}),null);
  assert.equal(telegramUserFromInitData(init+'&user=%7B%7D',{botToken:bot}),null);
});
test('Owner gets only their orders, foreign claims blocked, receipt token backward compatible',async()=>{
  const old={};for(const name of ['STORE_D1_URL','STORE_D1_TOKEN','TELEGRAM_BOT_TOKEN','STORE_DELIVERY_ENCRYPTION_KEY'])old[name]=process.env[name];
  const originalFetch=globalThis.fetch;
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');sql.exec(readFileSync(new URL('../store/schema-d1.sql',import.meta.url),'utf8'));
  const workerSecret='store-account-private-mock-token-1234567', url='https://store-worker.example/internal';
  const db={prepare(query){const stmt=sql.prepare(query);return {bind(...values){return {all(){return {results:stmt.all(...values)}},run(){return stmt.run(...values)}}}}},batch(statements){return statements.map(s=>s.run())}};
  const env={STORE_DB:db,STORE_D1_TOKEN:workerSecret};
  process.env.STORE_D1_URL=url;process.env.STORE_D1_TOKEN=workerSecret;process.env.TELEGRAM_BOT_TOKEN=bot;process.env.STORE_DELIVERY_ENCRYPTION_KEY='e'.repeat(64);
  globalThis.fetch=(u,o)=>handleRequest(new Request(u,o),env);
  const alice=signed({id:12345,first_name:'Alice'}),bob=signed({id:67890,first_name:'Bob'});
  const token='t'.repeat(44),id='f1e4d19c-6e4f-4e72-8c25-f852fd7148e7';
  try{
    sql.prepare("INSERT INTO store_products(provider,provider_listing_id,slug,title,category,description,supplier_price_cents,stock,published) VALUES('adsplus',101,'101','Facebook','Facebook','',1200,10,0)").run();
    sql.prepare("INSERT INTO store_orders(id,lookup_hash,customer_email,product_id,product_title,quantity,unit_price_cents,supplier_unit_price_cents,total_cents,pay_wallet,ip_hash,pay_amount_micro) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id,sha256(token),'buyer@example.invalid',1,'Facebook',1,200,1200,200,'TLEYJyCMjPjNXy3jFiyAfwTwXvgRuQY4VW','some-ip-hash',2000001);
    let result=await invoke(accountHandler,{initData:alice,action:'list',page:0});assert.equal(result.statusCode,200);assert.equal(result.body.orders.length,0);
    result=await invoke(accountHandler,{initData:alice,action:'claim',id,token});assert.equal(result.statusCode,200);
    result=await invoke(accountHandler,{initData:alice,action:'list',page:0});assert.equal(result.statusCode,200);assert.equal(result.body.orders.length,1);
    result=await invoke(accountHandler,{initData:bob,action:'list',page:0});assert.equal(result.statusCode,200);assert.equal(result.body.orders.length,0);
    result=await invoke(accountHandler,{initData:bob,action:'claim',id,token});assert.equal(result.statusCode,409);
    result=await invoke(receiptHandler,{id,initData:bob});assert.equal(result.statusCode,404);
    result=await invoke(receiptHandler,{id,initData:alice});assert.equal(result.statusCode,200);
    result=await invoke(receiptHandler,{id,token});assert.equal(result.statusCode,200);
    result=await invoke(accountHandler,{initData:alice.replace('Alice','Mallory'),action:'list',page:0});assert.equal(result.statusCode,401);
  }finally{
    globalThis.fetch=originalFetch;sql.close();
    for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
