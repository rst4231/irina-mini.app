import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import lava from '../api/lava.js';
import store from '../api/store.js';
const config=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const res=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(v){this.body=v;return this;},end(v){this.body=v;return this;}});
for(const [group,handler,actions] of [['lava',lava,['checkout','session','status','webhook']],['store',store,['account','admin','catalog','order','orders','verify-payment']]]){
  test(group+' router preserves all former API routes and rejects unknown handlers',async()=>{
    for(const action of actions){
      assert.ok(config.rewrites.some(r=>r.source==='/api/'+group+'/'+action&&r.destination==='/api/'+group+'?__irina_action='+action));
      const response=res();await handler({method:'DELETE',headers:{},url:'/api/'+group+'/'+action,query:{}},response);assert.equal(response.statusCode,405);
      const rewritten=res();await handler({method:'DELETE',headers:{},url:'/api/'+group,query:{__irina_action:action}},rewritten);assert.equal(rewritten.statusCode,405);
    }
    for(const action of ['constructor','__proto__','missing',['admin']]){const r=res();await handler({method:'GET',url:'/api/'+group,query:{__irina_action:action}},r);assert.equal(r.statusCode,404);}
  });
}
