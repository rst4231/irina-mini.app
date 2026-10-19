import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import receipt from '../api/store/order.js';
import verify from '../api/store/verify-payment.js';
import {handleRequest} from '../cloudflare/irina-store-d1-worker.js';
import {sha256} from '../lib/store/core.js';
import {USDT_TRC20} from '../lib/store/tron.js';

test('owner cancellation and 50-minute expiry preserve paid orders and recover timely transfers',async()=>{
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../store/schema-d1.sql',import.meta.url),'utf8'));
  db.exec("INSERT INTO store_products(id,provider_listing_id,slug,title,supplier_price_cents) VALUES(1,1,'test','Test',100)");
  const token='receipt-token-for-expiry-tests-long-enough',secret='private-worker-expiry-token-long-enough',wallet='TLEYJyCMjPjNXy3jFiyAfwTwXvgRuQY4VW';
  const ids=['a','b','c','d','e'].map(letter=>letter.repeat(8)+'-1111-4111-8111-111111111111');
  const now=Date.now(),old=new Date(now-51*60000).toISOString();
  for(const [index,id] of ids.entries())db.prepare('INSERT INTO store_orders(id,lookup_hash,customer_email,product_id,product_title,quantity,unit_price_cents,supplier_unit_price_cents,total_cents,pay_wallet,pay_amount_micro,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,sha256(token+index),'test@example.invalid',1,'Test',1,200,100,200,wallet,2000001+index,index===1?'fulfilling':'awaiting_payment',index>=2?old:new Date(now).toISOString());
  const adapter={prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {all(){return {results:stmt.all(...args)}},run(){return stmt.run(...args)}}}}}};
  const prior={...process.env},fetchOriginal=globalThis.fetch;let txTimestamp=Date.parse(old)+40*60000;
  process.env.STORE_D1_URL='https://expiry-worker.example/internal';process.env.STORE_D1_TOKEN=secret;process.env.STORE_TRONSCAN_API_KEY='test-only';
  globalThis.fetch=async(url,options)=>{
    if(new URL(url).host==='expiry-worker.example')return handleRequest(new Request(url,options),{STORE_DB:adapter,STORE_D1_TOKEN:secret});
    if(new URL(url).host==='apilist.tronscanapi.com'){
      const hash=new URL(url).searchParams.get('hash');const index=hash==='a'.repeat(64)?2:3;
      return Response.json({hash,confirmed:true,revert:false,contractRet:'SUCCESS',confirmations:25,timestamp:txTimestamp,trc20TransferInfo:[{contract_address:USDT_TRC20,to_address:wallet,type:'Transfer',decimals:6,status:0,amount_str:String(2000001+index)}]});
    }
    throw Error('Unexpected request '+url);
  };
  async function call(handler,index,extra={},customToken=token+index){const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};await handler({method:'POST',headers:{},body:{id:ids[index],token:customToken,...extra}},res);return res;}
  try{
    const initial=await call(receipt,0);
    assert.equal(Date.parse(initial.body.expiresAt)-Date.parse(initial.body.createdAt),50*60000);
    assert.equal((await call(receipt,0,{action:'cancel'},'wrong-token')).statusCode,404);
    assert.equal((await call(receipt,1,{action:'cancel'})).statusCode,409);
    assert.equal((await call(receipt,0,{action:'cancel'})).body.status,'cancelled');
    assert.equal((await call(receipt,0,{action:'cancel'})).body.status,'cancelled');
    const expired=await call(receipt,2);assert.equal(expired.body.status,'cancelled');assert.equal(expired.body.timedOut,true);
    const timely=await call(verify,2,{txHash:'a'.repeat(64)});assert.equal(timely.statusCode,200);assert.equal(timely.body.status,'fulfilling');
    txTimestamp=Date.parse(old)+50*60000;
    const late=await call(verify,3,{txHash:'b'.repeat(64)});assert.equal(late.statusCode,422);assert.equal(db.prepare('SELECT status FROM store_orders WHERE id=?').get(ids[3]).status,'cancelled');
    assert.equal((await call(verify,0,{txHash:'c'.repeat(64)})).body.status,'cancelled','manual cancellation is terminal');
  }finally{globalThis.fetch=fetchOriginal;for(const k of Object.keys(process.env))if(!(k in prior))delete process.env[k];Object.assign(process.env,prior);db.close();}
});
