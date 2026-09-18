import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('Buildin viewer matches Teacher CPA crop and excludes View Terms', async () => {
  const source = await readFile(new URL('../buildin-viewer.js', import.meta.url), 'utf8');
  assert.match(source, /buildin\.ai/);
  assert.match(source, /anchor\.id==='application-button'/);
  assert.match(source, /transform:translateY\(-56px\)!important/);
  assert.match(source, /height:calc\(100% \+ 246px\)!important/);
  assert.match(source, /@media \(min-width:768px\)/);
  assert.match(source, /height:calc\(100% \+ 356px\)!important/);
  assert.match(source, /buildin-viewer__action--home/);
  assert.match(source, /buildin-viewer__action--back/);
  new vm.Script(source);
});

test('Irina loads the internal Buildin viewer and CSP permits Buildin frames', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /src="\.\/buildin-viewer\.js"/);

  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers.flatMap((entry) => entry.headers || [])
    .find((item) => item.key === 'Content-Security-Policy')?.value || '';
  assert.match(csp, /frame-src[^;]*https:\/\/buildin\.ai[^;]*https:\/\/\*\.buildin\.ai/);
});
