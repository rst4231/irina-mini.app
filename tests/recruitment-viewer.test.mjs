import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('recruitment page opens inside an iframe without a Home button', async () => {
  const source = await readFile(new URL('../recruitment-viewer.js', import.meta.url), 'utf8');
  assert.match(source, /const HOST = 'team\.arbstart\.tech'/);
  assert.match(source, /url\.protocol === 'https:'/);
  assert.match(source, /document\.createElement\('iframe'\)/);
  assert.match(source, /anchor\.id !== buttonId/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /aria-label', 'Закрыть'/);
  assert.doesNotMatch(source, /Домой/);
  new vm.Script(source);
});

test('content security policy allows the HTTPS team page to be embedded', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers.flatMap((entry) => entry.headers || [])
    .find((item) => item.key === 'Content-Security-Policy')?.value || '';
  assert.match(csp, /frame-src[^;]*https:\/\/team\.arbstart\.tech/);
});
