import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main markup uses SVG icons and loads polish styles', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /polish\.css/);
  assert.match(html, /class="icon-svg"/);
  assert.match(html, /class="trusted-logo/);
  assert.doesNotMatch(html, /[📄👥⭐📘👨‍🏫✅⏳📝👀]/u);
});

test('keeps critical IDs and links used by app logic', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['application-card','application-button','join-team-button','about-button','book-button','trusted-by','mentor-button','footer-channel']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /https:\/\/t\.me\/teachercpa_bot/);
  assert.match(html, /https:\/\/t\.me\/\+dMBhIV90W_01ZjIy/);
});

test('app uses Telegram haptics and does not enforce the old 1.5 second delay', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8').catch(() => '');
  assert.match(source, /HapticFeedback/);
  assert.doesNotMatch(source, /wait\(1500\)|minimumDelay/);
});
