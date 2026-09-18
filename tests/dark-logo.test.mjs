import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dark theme gives all trusted logos full opacity and readable Conversion/Partnerkin colors', async () => {
  const css = await readFile(new URL('../polish.css', import.meta.url), 'utf8');
  assert.match(css, /html\[data-theme="dark"\] \.trusted-logo\s*\{[^}]*opacity:\s*1;/s);
  assert.match(css, /html\[data-theme="dark"\] \.trusted-logo-conversion\s*\{[^}]*color:\s*#d7e6ff;[^}]*fill:\s*#d7e6ff;/s);
  assert.match(css, /html\[data-theme="dark"\] \.trusted-logo-partnerkin\s*\{[^}]*color:\s*#b8c9e8;[^}]*fill:\s*#b8c9e8;/s);
});
