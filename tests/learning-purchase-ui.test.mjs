import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const code=await fs.readFile(new URL('../learning.js',import.meta.url),'utf8');
const lessons=[{id:'2b7ec973-20ef-4988-aeae-27a996b68733',section:'creatives',title:'Первый платный урок'}];
async function view(access,{failed=false}={}) {
  const app={innerHTML:''};
  const element={addEventListener(){},setAttribute(){}};
  const sandbox={URL,URLSearchParams,AbortSignal,Promise,Map,Set,Date,console,
    resolveLaunchData:()=>'',
    location:{search:'',origin:'https://irina.test',assign(){},replace(){}},
    document:{body:{dataset:{learningPage:'practice'}},documentElement:{dataset:{}},getElementById:id=>id==='learning-app'?app:element,querySelector:()=>null,addEventListener(){}},
    window:{sessionStorage:{getItem:()=>null},matchMedia:()=>({matches:false})},
    fetch:async(url,options)=>{
      if(url==='/api/learning-authorize')return {ok:!failed,status:failed?503:200,json:async()=>failed?{ok:false,error:'auth_unavailable'}:{ok:true,access}};
      return {ok:true,status:200,json:async()=>({ok:true,lessons,settings:{}})};
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code.replace(/^import .*;\n/,'').replace(/run\(\);\s*$/,'')+'\nglobalThis.views={showStore,showSection};',sandbox);
  return {app,...sandbox.views};
}
const cards=html=>[...html.matchAll(/<article class="product[^\"]*"[\s\S]*?<\/article>/g)].map(x=>x[0]);

test('full-kit buyer sees four purchased cards without prices and direct lesson navigation',async()=>{
  const v=await view({creatives:true,infrastructure:true,keitaro:true,launch:true});
  await v.showStore();
  assert.equal(cards(v.app.innerHTML).length,4);
  for(const card of cards(v.app.innerHTML)){
    assert.match(card,/Куплен/);assert.match(card,/Перейти/);assert.doesNotMatch(card,/1200|Выбрать|class="stars"/);
    assert.match(card,/href="\/practice\?topic=/);
  }
  assert.doesNotMatch(v.app.innerHTML,/3600|data-purchase-link/);
});

test('individual buyer keeps prices and purchase options for the remaining sections',async()=>{
  const v=await view({creatives:true,infrastructure:false,keitaro:false,launch:false});
  await v.showStore();
  const items=cards(v.app.innerHTML);
  assert.match(items[0],/Куплен/);assert.doesNotMatch(items[0],/1200/);
  for(const card of items.slice(1)){assert.match(card,/1200/);assert.match(card,/Выбрать/);assert.doesNotMatch(card,/Куплен/);}
});

test('purchased section opens the paid lesson list without an upsell or price',async()=>{
  const v=await view({creatives:true});
  await v.showSection('creatives');
  assert.match(v.app.innerHTML,/Первый платный урок/);
  assert.match(v.app.innerHTML,/lesson=2b7ec973-20ef-4988-aeae-27a996b68733/);
  assert.match(v.app.innerHTML,/Куплен/);
  assert.doesNotMatch(v.app.innerHTML,/1200|data-purchase-link|Перейти к покупке/);
});

test('failed purchase verification never marks products purchased or asks buyers to pay again',async()=>{
  const v=await view({}, {failed:true});
  await v.showSection('creatives');
  assert.doesNotMatch(v.app.innerHTML,/Куплен|Перейти к покупке/);
  assert.match(v.app.innerHTML,/Не удалось проверить/);
});
