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

test('includes skeleton, freshness and retry without a visible release label', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['loading-screen','freshness-indicator','sync-error','sync-retry-button']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="loading-skeleton"/);
  assert.doesNotMatch(html, /id="app-version"/);
  assert.doesNotMatch(html, />v\.04</);
});

test('loads the inline recruitment viewer and keeps the HTTPS recruitment link', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="https:\/\/team\.arbstart\.tech"/);
  assert.match(html, /recruitment-viewer\.js/);
  assert.match(html, /id="join-team-button"[\s\S]*?target="_self"/);
});

test('profile greets the user by first name without a date', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /Привет, Пользователь!/);
  assert.doesNotMatch(html, /id="profile-date"|class="profile-date-row"|skeleton-line-date/);
  assert.match(source, /getGreetingName\(sendPulseName\)/);
  assert.doesNotMatch(source, /date\.textContent|formatRussianDayMonth/);
});

test('approved application no longer displays action timing hint', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /state\.tone === 'approved' \? ''/);
  assert.match(source, /applicationHint\.hidden = !actionHint/);
});

test('guide library is internal and both native pages disable zoom', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const book = await readFile(new URL('../book.html', import.meta.url), 'utf8');
  assert.match(index, /Руководства по арбитражу трафика/);
  assert.match(index, /https:\/\/irina-miniapp\.vercel\.app\/book/);
  for (const html of [index, book]) {
    assert.match(html, /user-scalable=no/);
    assert.match(html, /zoom-lock\.js/);
  }
  assert.match(book, /690 ₽/);
  assert.match(book, /590 ₽/);
  assert.match(book, /book-profit\.webp/);
  assert.match(book, /book-beginner\.webp/);
});
