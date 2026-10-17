import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLaunchData, validLaunchData, SESSION_KEY, MAX_AGE_SECONDS} from '../learning-auth-session.js';
import {grantsLearningAccess} from '../api/learning-authorize.js';

const NOW=1792241000;
const signed = (authDate=NOW)=>new URLSearchParams({
  auth_date:String(authDate),
  user:JSON.stringify({id:10203040,first_name:'Test'}),
  hash:'a'.repeat(64),
}).toString();
function store(){
 const data=new Map();
 return {
   getItem:key=>data.get(key)||null,
   setItem:(key,value)=>data.set(key,value),
   removeItem:key=>data.delete(key),
 };
}

test('signed Telegram data survives navigation and grants access only with a matching tag',()=>{
 const storage=store();
 const start=resolveLaunchData(signed(),storage,NOW);
 assert.equal(start,signed());
 assert.equal(storage.getItem(SESSION_KEY),start);
 const nextPage=resolveLaunchData('',storage,NOW+15);
 assert.equal(nextPage,start);
 assert.equal(grantsLearningAccess(['Практика: Креативы'],'creatives'),true);
 assert.equal(grantsLearningAccess(['Практика: Креативы'],'launch'),false);
});

test('reject unsigned identity and expired Telegram data',()=>{
 const storage=store();
 const stale=signed(NOW-MAX_AGE_SECONDS-1);
 assert.equal(validLaunchData(stale,NOW),false);
 assert.equal(resolveLaunchData(stale,storage,NOW),'');
 assert.equal(resolveLaunchData('',storage,NOW),'');
 assert.equal(validLaunchData('user=%7B%22id%22%3A1%7D',NOW),false);
});

test('new Telegram launch refreshes session and blocked storage does not grant anonymous access',()=>{
 const storage=store();
 resolveLaunchData(signed(NOW-1000),storage,NOW);
 const newer=signed(NOW);
 assert.equal(resolveLaunchData(newer,storage,NOW),newer);
 assert.equal(resolveLaunchData('',null,NOW),'');
 assert.equal(resolveLaunchData(newer,{setItem(){throw new Error('storage_denied')}},NOW),newer);
});
