import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main app CSP allows same-origin proxy frame but skips CSP on proxy response', async () => {
  const config=JSON.parse(await readFile(new URL('../vercel.json', import.meta.url),'utf8'));
  assert.equal(config.headers[0].source,'/((?!api/buildin).*)');
  const csp=config.headers[0].headers.find((item)=>item.key==='Content-Security-Policy')?.value||'';
  assert.match(csp,/frame-src 'self'/);
});

test('Buildin API is implemented as a Vercel function', async () => {
  const source=await readFile(new URL('../api/buildin.js', import.meta.url),'utf8');
  assert.match(source,/normalizeBuildinUrl/);
  assert.match(source,/injectBuildinBridge/);
  assert.match(source,/redirect: 'follow'/);
  assert.match(source,/buildin_unavailable/);
});
