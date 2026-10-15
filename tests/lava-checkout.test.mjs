import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('books use the original direct Lava.top product links in a separate tab', async () => {
  const html = await readFile(new URL('../book.html', import.meta.url), 'utf8');
  const books = [
    ['profit', '1a995492-be5d-4957-8dfb-29bb21d7f387', '690'],
    ['beginner', 'cfdceb95-cf9d-49d6-babc-736ade4edbc6', '590'],
  ];
  for (const [book, id, price] of books) {
    const expected = '<a class="buy" href="https://app.lava.top/products/' + id
      + '" target="_blank" rel="noopener noreferrer external" data-external-purchase="'
      + book + '">Перейти к покупке';
    assert.ok(html.includes(expected), 'External purchase link missing for ' + book);
  }
  assert.match(html, /<script defer src="\/book-checkout\.js"><\/script>/);
  assert.doesNotMatch(html, /data-checkout-book|id="checkout-dialog"|id="checkout-email"|id="payment-result"/);
  assert.doesNotMatch(html, /Купить за 1 ₽|Купить за 690 ₽|Купить за 590 ₽/);
});

test('Telegram opens Lava product links externally, never in the Mini App', async () => {
  const script = await readFile(new URL('../book-checkout.js', import.meta.url), 'utf8');
  assert.match(script, /telegram\.openLink\(url, \{ try_instant_view: false \}\)/);
  assert.match(script, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/);
  assert.match(script, /telegram\.platform === 'unknown'/);
  assert.doesNotMatch(script, /location\.assign|window\.location\.href\s*=|\/api\/lava\/checkout|\/api\/lava\/session/);
});

test('homepage no longer creates a book purchase session', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /\/api\/lava\/session/);
  assert.match(app, /resource-button, \.footer-telegram-icon/);
});

test('high-resolution book cover files are preserved', async () => {
  const first = await stat(new URL('../book-profit.webp', import.meta.url));
  const second = await stat(new URL('../book-beginner.webp', import.meta.url));
  assert.ok(first.size > 25_000);
  assert.ok(second.size > 50_000);
});

test('direct book purchase controls contain no server credentials', async () => {
  for (const path of ['book.html', 'book-checkout.js']) {
    const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /LAVA_TOP_API_KEY|BOOK_ORDERS_D1_TOKEN|SENDPULSE_API_KEY/);
  }
});
