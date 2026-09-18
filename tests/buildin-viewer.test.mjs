import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('Irina uses the current direct Teacher CPA Buildin viewer and keeps View Terms excluded', async () => {
  const source = await readFile(new URL('../buildin-viewer.js', import.meta.url), 'utf8');
  assert.match(source, /frame\.src=safeUrl/);
  assert.doesNotMatch(source, /\/api\/buildin\?url=/);
  assert.match(source, /anchor\.id==='application-button'/);
  assert.match(source, /transform:translateY\(-56px\)!important/);
  assert.match(source, /height:calc\(100% \+ 246px\)!important/);
  assert.match(source, /@media \(min-width:700px\), \(hover:hover\) and \(pointer:fine\)/);
  assert.match(source, /height:calc\(100% \+ 286px\)!important/);
  assert.match(source, /buildin-viewer__action--home/);
  assert.match(source, /buildin-viewer__action--back/);
  new vm.Script(source);
});

test('CSP permits direct Buildin frames', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers.flatMap((entry) => entry.headers || [])
    .find((item) => item.key === 'Content-Security-Policy')?.value || '';
  assert.match(csp, /frame-src[^;]*https:\/\/buildin\.ai[^;]*https:\/\/\*\.buildin\.ai/);
});
