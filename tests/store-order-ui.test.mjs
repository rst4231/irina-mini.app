import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

class Node{constructor(){this.handlers={};this.dataset={};this.hidden=false;this.textContent='';this.value='';}addEventListener(name,fn){this.handlers[name]=fn;}}
test('payment timer survives reload, expires on server time and owner can cancel',async()=>{
  const html=readFileSync(new URL('../store/order.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Node()]));
  nodes.set('#verify-payment-form button',new Node());nodes.set('#payment-section [data-l="payHelp"]',new Node());
  let clock=0,calls=0,status='awaiting_payment';const events={};
  const now=Date.now(),createdAt=new Date(now).toISOString(),expiresAt=new Date(now+50*60000).toISOString();
  class WrongClockDate extends Date{static now(){return now+365*86400000;}}
  const context={document:{documentElement:{},hidden:false,querySelector:id=>nodes.get(id),querySelectorAll:()=>[],addEventListener(name,fn){events[name]=fn}},navigator:{language:'ru'},location:{hash:'#id=aaaaaaaa-1111-4111-8111-111111111111&token=long-receipt-token'},window:{},URLSearchParams,Date:WrongClockDate,performance:{now:()=>clock},setTimeout(){},setInterval(){},confirm:()=>true,
    fetch:async(url,options)=>{calls++;const body=JSON.parse(options.body);if(body.action==='cancel')status='cancelled';if(clock>=50*60000&&status==='awaiting_payment')status='cancelled';return {ok:true,json:async()=>({id:body.id,status,title:'Test',total:5,quantity:1,createdAt,expiresAt,serverNow:now+clock,timedOut:status==='cancelled'&&clock>=50*60000,items:null})};}};
  vm.runInNewContext(readFileSync(new URL('../store/assets/order.js',import.meta.url),'utf8'),context);
  await new Promise(r=>setImmediate(r));
  assert.equal(nodes.get('#payment-countdown').textContent,'50:00');
  clock=12*60000;await context.load(true);
  assert.equal(nodes.get('#payment-countdown').textContent,'38:00','reload uses original deadline');
  assert.equal(nodes.get('#cancel-order').hidden,false);
  clock=50*60000;context.tick();await new Promise(r=>setImmediate(r));
  assert.equal(nodes.get('#ord-status').textContent,'Отменён');
  assert.equal(nodes.get('#payment-countdown').textContent,'00:00');
  assert.equal(nodes.get('#payment-instructions').hidden,true);
  assert.equal(nodes.get('#cancel-order').hidden,true);
  assert.equal(nodes.get('#verify-payment-form').hidden,false,'timely transfers remain verifiable');
  clock=0;status='awaiting_payment';await context.load(true);
  await nodes.get('#cancel-order').handlers.click();
  assert.equal(nodes.get('#ord-status').textContent,'Отменён');
  assert.equal(nodes.get('#payment-section').hidden,true,'manual cancellation hides payment controls');
  status='fulfilling';await context.load(true);
  assert.equal(nodes.get('#cancel-order').hidden,true,'paid orders cannot be cancelled');
  assert.ok(calls>=5);
});
