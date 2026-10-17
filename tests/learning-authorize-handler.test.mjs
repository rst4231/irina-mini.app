import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/learning-authorize.js';
import {createLearningCookie} from '../api/learning-cookie.js';

const token='test-bot-token';
const userId='10203040';
function signedLaunch() {
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:Number(userId)})});
  const check=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const key=crypto.createHmac('sha256','WebAppData').update(token).digest();
  params.set('hash',crypto.createHmac('sha256',key).update(check).digest('hex'));
  return params.toString();
}
function response() {
  return {statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
async function authorize(t,{initData='',cookie='',tags=['Практика: Креативы'],section='creatives'}={}) {
  const savedToken=process.env.TELEGRAM_BOT_TOKEN;
  const savedKey=process.env.SENDPULSE_API_KEY;
  process.env.TELEGRAM_BOT_TOKEN=token;
  process.env.SENDPULSE_API_KEY='test-sendpulse-key';
  t.after(()=>{
    if(savedToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=savedToken;
    if(savedKey===undefined)delete process.env.SENDPULSE_API_KEY;else process.env.SENDPULSE_API_KEY=savedKey;
  });
  t.mock.method(globalThis,'fetch',async url=>{
    const parsed=new URL(url);
    assert.equal(parsed.origin,'https://api.sendpulse.com');
    assert.equal(parsed.searchParams.get('telegram_id'),userId);
    assert.equal(parsed.searchParams.get('bot_id'),'6671465ac84ab24b4702fa25');
    return Response.json({data:{tags}});
  });
  const res=response();
  await handler({method:'POST',headers:{cookie},body:{section,initData}},res);
  return res;
}

test('signed Telegram buyer reaches SendPulse and receives the matching lesson grant',async t=>{
  const res=await authorize(t,{initData:signedLaunch()});
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body,{ok:true,authorized:true,section:'creatives'});
});

test('buyer retains lesson access through the verified cookie after page navigation',async t=>{
  const res=await authorize(t,{cookie:createLearningCookie(userId,token)});
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body,{ok:true,authorized:true,section:'creatives'});
});

test('verified buyer cannot read a section purchased by someone else or another section',async t=>{
  const res=await authorize(t,{cookie:createLearningCookie(userId,token),tags:['Практика: Keitaro']});
  assert.equal(res.statusCode,403);
  assert.equal(res.body.error,'purchase_required');
});

test('forged identity cannot reach SendPulse even with a purchase tag',async t=>{
  const res=await authorize(t,{cookie:createLearningCookie(userId,'wrong-token')});
  assert.equal(res.statusCode,403);
  assert.equal(res.body.error,'purchase_required');
  assert.equal(globalThis.fetch.mock.calls.length,0);
});

test('catalog purchases are verified once and the full-kit tag opens all four sections',async t=>{
  const res=await authorize(t,{initData:signedLaunch(),section:'all',tags:['Практика: Все']});
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body,{ok:true,access:{creatives:true,infrastructure:true,keitaro:true,launch:true}});
  assert.equal(globalThis.fetch.mock.calls.length,1);
});

test('catalog purchases only mark the section with a matching tag',async t=>{
  const res=await authorize(t,{cookie:createLearningCookie(userId,token),section:'all'});
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body.access,{creatives:true,infrastructure:false,keitaro:false,launch:false});
});

test('catalog purchases never trust a forged identity',async t=>{
  const res=await authorize(t,{cookie:createLearningCookie(userId,'wrong-token'),section:'all',tags:['Практика: Все']});
  assert.equal(res.statusCode,403);
  assert.equal(globalThis.fetch.mock.calls.length,0);
});
