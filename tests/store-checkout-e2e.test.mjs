import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleRequest} from '../cloudflare/irina-store-d1-worker.js';
import createOrder from '../api/store/orders.js';
import verifyPayment from '../api/store/verify-payment.js';
import readReceipt from '../api/store/order.js';
import {USDT_TRC20} from '../lib/store/tron.js';

const wallet='TLEYJyCMjPjNXy3jFiyAfwTwXvgRuQY4VW';
const auth='store-e2e-database-token-please-do-not-use-in-production';
const txid='3'.repeat(64);
const realFetch=globalThis.fetch;
function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}
function mockResponse(){return {statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(value){this.data=value;return this;}};}
async function invoke(handler,method,body){const res=mockResponse();await handler({method,body,headers:{host:'irina-miniapp.vercel.app'},socket:{remoteAddress:'127.0.0.1'}},res);return res;}

test('checkout creates invoice; rejects wrong payment; verifies TRC20 and buys exactly once',async()=>{
  const prior={};for(const name of ['STORE_D1_URL','STORE_D1_TOKEN','STORE_ADSPLUS_API_KEY','STORE_TRONSCAN_API_KEY','STORE_PAYMENT_CONFIRMATION_MODE','STORE_ADMIN_TOKEN','STORE_DELIVERY_ENCRYPTION_KEY','STORE_ALLOW_AUTOFULFILL']){prior[name]=process.env[name];}
  const database=new DatabaseSync(':memory:');database.exec('PRAGMA foreign_keys=ON');database.exec(readFileSync(new URL('../store/schema-d1.sql',import.meta.url),'utf8'));
  database.prepare("UPDATE store_settings SET value='true' WHERE key IN ('checkout_enabled','supplier_resale_approved','auto_fulfillment_enabled')").run();
  database.prepare('UPDATE store_settings SET value=? WHERE key=?').run(JSON.stringify(wallet),'usdt_trc20_wallet');
  database.prepare("INSERT INTO store_products(provider,provider_listing_id,slug,title,title_ru,title_en,category,category_ru,category_en,description,supplier_price_cents,stock,published) VALUES('adsplus',123,'123','Facebook account','Аккаунт Facebook','Facebook account','Facebook Accounts','Аккаунты Facebook','Facebook Accounts','Test',5000,12,1)").run();
  const D1={prepare(sql){const statement=database.prepare(sql);return {bind(...args){return {all(){return {results:statement.all(...args)}},run(){return statement.run(...args)}}}}},async batch(stmts){return stmts.map(s=>s.run())}};
  const env={STORE_DB:D1,STORE_D1_TOKEN:auth};
  process.env.STORE_D1_URL='https://store-worker.example/internal';
  process.env.STORE_D1_TOKEN=auth;
  process.env.STORE_ADSPLUS_API_KEY='adp_'+'4'.repeat(50);
  process.env.STORE_TRONSCAN_API_KEY='test-readonly';
  process.env.STORE_PAYMENT_CONFIRMATION_MODE='tronscan';
  process.env.STORE_ADMIN_TOKEN='this-test-admin-token-is-very-long-and-random';
  process.env.STORE_DELIVERY_ENCRYPTION_KEY='b'.repeat(64);
  process.env.STORE_ALLOW_AUTOFULFILL='true';
  let wrongAmount=true,buyCalls=0,expectedMicro=0,createdMs=0;
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(input);
    if(url.host==='store-worker.example')return handleRequest(new Request(url,{...options,headers:options.headers||{}}),env);
    if(url.host==='adsplusth.com'){
      if(url.pathname.endsWith('/balance'))return jsonResponse({ok:true,data:{balance:'1000.00',currency:'THB'}});
      if(url.pathname.endsWith('/products'))return jsonResponse({ok:true,data:{products:[{product:123,name:'Facebook account',category:'Facebook Accounts',price:'50.00',currency:'THB',stock:12,min:1,max:20}]}});
      if(url.pathname.endsWith('/buy')){buyCalls++;return jsonResponse({ok:true,data:{order:678,count:1,accounts:['demo-login@example.invalid:demo-password']}});}
      throw Error('Unexpected supplier action '+url.pathname);
    }
    if(url.host==='api.frankfurter.dev')return jsonResponse({base:'THB',quote:'USD',rate:0.03,date:new Date().toISOString().slice(0,10)});
    if(url.host==='apilist.tronscanapi.com')return jsonResponse({hash:txid,confirmed:true,revert:false,contractRet:'SUCCESS',confirmations:25,timestamp:createdMs+1000,trc20TransferInfo:[{contract_address:USDT_TRC20,to_address:wallet,type:'Transfer',tokenType:'trc20',decimals:6,status:0,amount_str:String(expectedMicro+(wrongAmount?1:0))}]});
    throw Error('Unexpected network request '+url);
  };
  try{
    const created=await invoke(createOrder,'POST',{productId:1,quantity:1,email:'shopper@example.invalid'});
    assert.equal(created.statusCode,201,JSON.stringify(created.data));
    assert.match(created.data.payAmount,/^\d+\.\d{6}$/);
    expectedMicro=database.prepare('SELECT pay_amount_micro FROM store_orders WHERE id=?').get(created.data.id).pay_amount_micro;
    createdMs=Date.parse(database.prepare('SELECT created_at FROM store_orders WHERE id=?').get(created.data.id).created_at);
    assert.equal(buyCalls,0,'invoice creation does not purchase from supplier');
    const input={id:created.data.id,token:created.data.token,txHash:txid};
    const bad=await invoke(verifyPayment,'POST',input);
    assert.equal(bad.statusCode,422,'wrong amount rejected');
    assert.equal(buyCalls,0);
    wrongAmount=false;
    const good=await invoke(verifyPayment,'POST',input);
    assert.equal(good.statusCode,200,JSON.stringify(good.data));
    assert.equal(good.data.status,'fulfilled');
    assert.equal(buyCalls,1);
    const repeat=await invoke(verifyPayment,'POST',input);
    assert.equal(repeat.statusCode,200);
    assert.equal(repeat.data.status,'fulfilled');
    assert.equal(buyCalls,1,'verify replay must not buy again');
    const receipt=await invoke(readReceipt,'POST',{id:input.id,token:input.token});
    assert.equal(receipt.statusCode,200);
    assert.equal(receipt.data.status,'fulfilled');
    assert.deepEqual(receipt.data.items,['demo-login@example.invalid:demo-password']);
    const wrongToken=await invoke(readReceipt,'POST',{id:input.id,token:'x'.repeat(45)});
    assert.equal(wrongToken.statusCode,404,'delivery is inaccessible with wrong receipt token');
  }finally{globalThis.fetch=realFetch;database.close();for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
