import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import admin from '../api/store/admin.js';
import {handleRequest} from '../cloudflare/irina-store-d1-worker.js';

const secret='profit-tests-private-token-long-enough';
test('profit report includes every fulfilled sale, filters Moscow months, excludes unpaid orders',async()=>{
  const database=new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../store/schema-d1.sql',import.meta.url),'utf8'));
  database.exec("INSERT INTO store_products(id,provider_listing_id,slug,title,supplier_price_cents) VALUES(1,1,'test','Test',5000)");
  const insert=database.prepare('INSERT INTO store_orders(id,lookup_hash,customer_email,product_id,product_title,quantity,unit_price_cents,supplier_unit_price_cents,total_cents,pay_wallet,status,pay_amount_micro,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
  let suffix=0;
  function sale(id,status,createdAt,total=500){insert.run(id,id,'test@example.invalid',1,'Test',2,total/2,5000,total,'test',status,total*10000+(++suffix),createdAt);}
  for(let i=0;i<501;i++)sale('sale-'+i,'fulfilled','2026-10-15T12:00:00.000Z');
  sale('moscow-start','fulfilled','2026-09-30T21:00:00.000Z');
  sale('previous-month','fulfilled','2026-09-30T20:59:59.999Z');
  sale('next-month','fulfilled','2026-10-31T21:00:00.000Z');
  sale('loss','fulfilled','2026-10-20T00:00:00.000Z',200);
  for(const status of ['awaiting_payment','cancelled','fulfilling','needs_review'])sale(status,status,'2026-10-15T12:00:00.000Z');
  sale('month-last-second','fulfilled','2026-10-31T20:59:59.999Z');
  const workerDb={prepare(sql){const stmt=database.prepare(sql);return {bind(...args){return {all(){return {results:stmt.all(...args)}},run(){return stmt.run(...args)}}}}}};
  const previousFetch=globalThis.fetch;
  const previousEnv={...process.env};
  process.env.STORE_ADMIN_TOKEN=secret;
  process.env.STORE_D1_URL='https://profit-worker.example/internal';
  process.env.STORE_D1_TOKEN=secret;
  delete process.env.STORE_ADSPLUS_API_KEY;
  let reads=0,fxDown=true;
  globalThis.fetch=async(url,options)=>{
    if(new URL(url).host==='profit-worker.example'){
      const request=JSON.parse(options.body);
      assert.equal(request.method,'GET','profit report must be read-only');
      if(request.table==='store_orders')reads++;
      return handleRequest(new Request(url,options),{STORE_DB:workerDb,STORE_D1_TOKEN:secret});
    }
    if(new URL(url).host==='api.frankfurter.dev'&&fxDown)return new Response('unavailable',{status:503});
    if(new URL(url).host==='api.frankfurter.dev')return Response.json({base:'THB',quote:'USD',rate:0.03,date:new Date().toISOString().slice(0,10)});
    throw Error('Unexpected URL '+url);
  };
  async function request(month,authorized=true){
    const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this},json(data){this.data=data;return this}};
    await admin({method:'GET',query:{report:'profit',month},headers:{authorization:authorized?'Bearer '+secret:'Bearer invalid'}},res);
    return res;
  }
  try{
    const unavailable=(await request('2026-10')).data.profit;
    assert.equal(unavailable.orderCount,504);
    assert.equal(unavailable.profitMicro,null,'do not invent a profit when the exchange rate is unavailable');
    assert.equal(unavailable.costMicro,null);
    assert.equal(unavailable.revenueMicro,503*5000000+2000000);
    fxDown=false;
    const result=await request('2026-10');
    assert.equal(result.statusCode,200);
    assert.ok(result.data.profit,'must return a profit summary');
    assert.equal(result.data.profit.currency,'USD');
    assert.equal(result.data.profit.orderCount,504);
    assert.equal(result.data.profit.revenueMicro,503*5000000+2000000);
    assert.equal(result.data.profit.costMicro,504*3000000);
    assert.equal(result.data.profit.profitMicro,503*2000000-1000000);
    assert.equal(result.data.profit.estimated,true,'THB conversion uses current FX and must be labelled');
    assert.ok(reads>=2,'must read beyond the first page');
    assert.equal((await request('all')).data.profit.orderCount,506);
    const empty=(await request('2025-01')).data.profit;
    assert.equal(empty.orderCount,0);
    assert.equal(empty.profitMicro,0);
    assert.equal((await request('2026-13')).statusCode,400);
    assert.equal((await request('2026-1')).statusCode,400);
    assert.equal((await request('2026-10',false)).statusCode,401);
  }finally{
    globalThis.fetch=previousFetch;
    for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];
    Object.assign(process.env,previousEnv);
    database.close();
  }
});
