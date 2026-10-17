import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
async function appLanguage(saved,device) {
 const context=vm.createContext({Intl,navigator:{language:device},NodeFilter:{SHOW_TEXT:4},localStorage:{getItem(key){return key==='irina_language'?saved:null;}},document:{body:{},documentElement:{},createTreeWalker(){return {nextNode(){return false}};},querySelectorAll(){return [];}},addEventListener(){}});
 context.window=context;
 for(const file of ['book-locale.js','app-language.js']) vm.runInContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),context);
 return context.AppLanguage;
}
test('homepage English rendering covers every application state and preserves the name',async()=>{
 const app=await appLanguage(null,'en-GB');
 assert.equal(app.language,'en');
 assert.equal(app.t('Привет, {name}!',{name:'Рустам'}),'Hi, Рустам!');
 assert.equal(app.t('Анкета не заполнена'),'Application not completed');
 assert.equal(app.t('Анкета заполнена'),'Application submitted');
 assert.equal(app.t('Анкета одобрена'),'Application approved');
 assert.equal(app.t('Анкета не одобрена'),'Application declined');
 assert.equal(app.t('Обновлено {n} мин назад',{n:3}),'Updated 3 min ago');
});
test('homepage honors the language saved on the book page and defaults non-English devices to Russian',async()=>{
 assert.equal((await appLanguage('ru','en-US')).t('Повторить'),'Повторить');
 assert.equal((await appLanguage('en','ru-RU')).t('Повторить'),'Retry');
 assert.equal((await appLanguage(null,'it-IT')).language,'ru');
});
