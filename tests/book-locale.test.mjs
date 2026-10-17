import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function locale() {
  const context = vm.createContext({Intl});
  const source = await readFile(new URL('../book-locale.js', import.meta.url), 'utf8').catch(()=>'');
  vm.runInContext(source,context);
  return context.BookLocale;
}
test('English device selects EN, a saved choice overrides device language',async()=>{
  const api=await locale();
  assert.equal(api?.resolveLanguage('', 'en-US'),'en');
  assert.equal(api.resolveLanguage('ru','en-GB'),'ru');
  assert.equal(api.resolveLanguage('en','ru-RU'),'en');
  assert.equal(api.resolveLanguage('invalid','ru-RU'),'ru');
  assert.equal(api.resolveLanguage('',undefined),'ru');
});
test('English prices use dollars and Russian prices use rubles without conversion guesses',async()=>{
  const api=await locale();
  assert.equal(api?.formatPrice({rub:690,usd:8.28},'en'),'$8.28');
  assert.match(api.formatPrice({rub:590,usd:7.08},'ru'),/590\s*₽/);
});
