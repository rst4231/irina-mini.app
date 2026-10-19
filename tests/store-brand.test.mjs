import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('LH STORE branding, favicon and no Beta on all three storefront pages',()=>{
  for(const page of ['store.html','store/admin.html','store/order.html']){
    const html=read(page);
    assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/store\/favicon\.svg">/);
    assert.match(html,/LH STORE/);
    assert.doesNotMatch(html,/ADSPLY|<span class="brand-tag">BETA<\/span>/);
  }
  const icon=read('store/favicon.svg');
  assert.match(icon,/<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(icon,/LH STORE/);
});
test('the retired closing banner and user-requested disclosure are absent',()=>{
  const html=read('store.html');
  const locale=read('store/assets/app.js');
  assert.doesNotMatch(html,/class="closing shell"|Нужное решение ближе|ГОТОВЫ К СТАРТУ|Только проверенные и разрешённые к перепродаже/);
  assert.doesNotMatch(locale,/Нужное решение ближе|ГОТОВЫ К СТАРТУ|The right solution/);
});
