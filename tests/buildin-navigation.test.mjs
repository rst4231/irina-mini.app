import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Buildin viewer uses same-origin proxy and keeps its own page history', async () => {
  const source = await readFile(new URL('../buildin-viewer.js', import.meta.url), 'utf8');
  assert.match(source, /\/api\/buildin\?url=/);
  assert.match(source, /buildinHistory/);
  assert.match(source, /buildin:navigate/);
  assert.match(source, /buildin:history-push/);
  assert.match(source, /buildin:history-replace/);
  assert.match(source, /buildinHistory\.length>1/);
  assert.match(source, /anchor\.id==='application-button'/);
});

test('viewer does not crop useful content below the viewport', async () => {
  const source = await readFile(new URL('../buildin-viewer.js', import.meta.url), 'utf8');
  assert.match(source, /height:calc\(100% \+ 56px\)!important/);
  assert.doesNotMatch(source, /\+ 246px/);
  assert.doesNotMatch(source, /\+ 326px|\+ 436px/);
});
