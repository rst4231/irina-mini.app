import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const load=path=>fs.readFile(new URL(path,import.meta.url),'utf8');

test('practice requires a signed Telegram session before loading any catalog',async()=>{
 const code=await load('../learning.js');
 const start=code.indexOf('async function run(){');
 const gate=code.indexOf("if(page==='practice' && !telegramInitData())",start);
 const firstQuery=code.indexOf('const q=currentQuery();',start);
 assert.ok(start>=0);
 assert.ok(gate>start&&gate<firstQuery,'guard executes before lesson selection or API access');
 assert.match(code.slice(gate,firstQuery),/showPracticeTelegramGate\(\)/);
 assert.match(code.slice(gate,firstQuery),/return;/);
 assert.match(code,/function showPracticeTelegramGate\(\)/);
});

test('outside Telegram receives a placeholder with bot link, without listing paid lessons',async()=>{
 const code=await load('../learning.js');
 const from=code.indexOf('function showPracticeTelegramGate(){');
 const to=code.indexOf('async function run(){',from);
 assert.ok(from>=0 && to>from);
 const app={innerHTML:''};
 const factory=new Function('app','purchaseURL','esc',code.slice(from,to)+';return showPracticeTelegramGate;');
 const display=factory(app,'https://t.me/rstshelp_bot?start=example',v=>String(v));
 display();
 assert.match(app.innerHTML,/Откройте практику в Telegram/);
 assert.match(app.innerHTML,/Перейти в Telegram/);
 assert.match(app.innerHTML,/t.me\/rstshelp_bot/);
 assert.doesNotMatch(app.innerHTML,/Креативы.*1200|Инфраструктура Facebook Ads.*1200/);
});

test('the free theory is unaffected by practice-only bot gate',async()=>{
 const code=await load('../learning.js');
 const section=code.slice(code.indexOf('async function run(){'));
 assert.ok(section.includes("page==='practice' && !telegramInitData()"));
 assert.ok(section.includes("if(page==='theory')"));
});
