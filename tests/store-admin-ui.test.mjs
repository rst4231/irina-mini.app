import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Minimal DOM records the actual nodes rendered by the admin script.
class Node{
  constructor(){this.children=[];this.handlers={};this.attributes={};this.style={};this.value='';this.hidden=false;this._text='';}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this._text='';this.children=nodes;}
  addEventListener(name,fn){this.handlers[name]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
}
test('admin renders USD profit, Telegram identity, empty/error states and keeps latest month response',async()=>{
  const html=readFileSync(new URL('../store/admin.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Node()]));
  let mode='normal',pending;
  const base={month:'2026-10',currency:'USD',orderCount:2,revenueMicro:10000000,costMicro:6000000,profitMicro:4000000,rate:.03};
  const context={document:{querySelector:id=>nodes.get(id),createElement:()=>new Node()},sessionStorage:{getItem(){return ''},setItem(){},removeItem(){}},Intl,Date,console,
    fetch:async url=>{
      const month=new URL(url,'https://example.com').searchParams.get('month');
      if(month==='2026-08')return new Promise(resolve=>{pending=()=>resolve({ok:true,json:async()=>({profit:{...base,month,profitMicro:99000000}})})});
      if(mode==='error')return {ok:false,status:503,json:async()=>({error:'Unavailable'})};
      return {ok:true,json:async()=>({profit:mode==='empty'?{...base,month,orderCount:0,revenueMicro:0,costMicro:0,profitMicro:0,rate:null}:{...base,month}})};
    }};
  vm.runInNewContext(readFileSync(new URL('../store/assets/admin.js',import.meta.url),'utf8'),context);
  await context.loadProfit();
  assert.equal(nodes.get('#profit-value').textContent,'4,00 $');
  assert.equal(nodes.get('#profit-revenue').textContent,'10,00 $');
  assert.equal(nodes.get('#profit-cost').textContent,'6,00 $');
  context.renderOrders([{id:'test-uuid',created_at:'2026-10-19',product_title:'Test',customer_email:'test@example.invalid',quantity:1,total:5,status:'cancelled',telegram_user_id:'123',telegram_first_name:'Рустам',telegram_username:'test_user'}]);
  assert.match(nodes.get('#admin-orders').textContent,/Рустам@test_user/);
  context.renderOrders([{id:'old-order',created_at:'2026-10-19',product_title:'Test',customer_email:'test@example.invalid',quantity:1,total:5,status:'cancelled'}]);
  assert.match(nodes.get('#admin-orders').textContent,/Telegram не указан/);
  nodes.get('#profit-month').value='2026-08';const first=context.loadProfit();
  nodes.get('#profit-month').value='2026-09';await context.loadProfit();pending();await first;
  assert.match(nodes.get('#profit-period').textContent,/сентябрь/);
  assert.equal(nodes.get('#profit-value').textContent,'4,00 $');
  mode='error';await context.loadProfit();
  assert.equal(nodes.get('#profit-value').textContent,'—');
  assert.equal(nodes.get('#profit-period').textContent,'Не удалось загрузить профит');
  mode='empty';await context.loadProfit();
  assert.equal(nodes.get('#profit-value').textContent,'0,00 $');
  assert.equal(nodes.get('#profit-count').textContent,'0');
  nodes.get('#profit-all').handlers.click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.get('#profit-period').textContent,'За всё время');
  assert.equal(nodes.get('#profit-all').attributes['aria-pressed'],'true');
});
