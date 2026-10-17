import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/irina-learning-api.js';

const section='creatives', id='2b7ec973-20ef-4988-aeae-27a996b68733';
const lesson={id,section,title:'Креативы',body:'Платный материал'};
function database() {
  return {reads:0,prepare(){return {bind:()=>({first:async()=>{this.reads++;return lesson;}})};}};
}
function request(){return new Request('https://learning.test/lesson',{method:'POST',body:JSON.stringify({id,section,initData:'signed-launch-data'})});}

test('paid lesson reaches authorization using redirect modes supported by Workers',async t=>{
  const db=database();
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    if(!['follow','manual'].includes(options.redirect))throw new TypeError('Invalid redirect value, must be follow or manual');
    return Response.json({ok:true,authorized:true,section});
  });
  const response=await worker.fetch(request(),{LEARNING_DB:db});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).lesson,lesson);
  assert.equal(db.reads,1);
});

for(const status of [302,403,503])test('authorization status '+status+' never exposes a paid lesson',async t=>{
  const db=database();
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status}));
  const response=await worker.fetch(request(),{LEARNING_DB:db});
  assert.equal(response.status,status===403?403:503);
  assert.equal(db.reads,0);
});

test('a grant for another section never exposes a paid lesson',async t=>{
  const db=database();
  t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,authorized:true,section:'keitaro'}));
  assert.equal((await worker.fetch(request(),{LEARNING_DB:db})).status,403);
  assert.equal(db.reads,0);
});
