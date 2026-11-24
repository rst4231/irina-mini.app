import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const code=await fs.readFile(new URL('../learning.js',import.meta.url),'utf8');
test('practice is closed for everyone before any catalog or lesson request',()=>{
 const start=code.indexOf('async function run(){');
 const gate=code.indexOf("if(page==='practice')",start);
 const query=code.indexOf('const q=currentQuery();',start);
 assert.ok(gate>start&&gate<query);
 assert.match(code.slice(gate,query),/showPracticeTelegramGate\(\)/);
 assert.match(code.slice(gate,query),/return;/);
 const ui=code.slice(code.indexOf('function showPracticeTelegramGate(){'),start);
 assert.match(ui,/Практические инструкции недоступны/);
 assert.doesNotMatch(ui,/t\.me|Купить|data-purchase-link/);
 assert.match(ui,/href="\/theory"/);
});
