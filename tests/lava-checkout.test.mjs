import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { selectOffer } from '../api/lava/checkout.js';

const productId = '1a995492-be5d-4957-8dfb-29bb21d7f387';
const offerId = '12345678-1111-4111-8111-1234567890ab';
const sampleBook = { id: productId, price: 690 };

test('Lava checkout selects the matching RUB offer for a product', () => {
  assert.equal(selectOffer([{id:productId,offers:[{id:offerId,currency:'RUB',price:690}]}],sampleBook),offerId);
  assert.equal(selectOffer([{id:'00000000-1111-4111-8111-1234567890ab',offers:[{id:offerId}]}],sampleBook),null);
});

test('Lava rejects explicit wrong price instead of silently charging the buyer', () => {
  assert.equal(selectOffer([{id:productId,offers:[{id:offerId,currency:'RUB',price:1590}]}],sampleBook),null);
});

test('book page opens checkout in same webview instead of a new tab', async () => {
  const html = await readFile(new URL('../book.html',import.meta.url),'utf8');
  const script = await readFile(new URL('../book-checkout.js',import.meta.url),'utf8');
  for (const name of ['profit','beginner']) assert.match(html,new RegExp('data-checkout-book="'+name+'"'));
  assert.doesNotMatch(html,/href="https:\/\/app\.lava\.top\/products\//);
  assert.match(script,/location\.assign\(url\.href\)/);
  assert.doesNotMatch(script,/window\.open\(/);
  assert.match(html,/checkout-email/);
});

test('high-quality local covers replace 3KB thumbnails', async () => {
  const profit = await stat(new URL('../book-profit.webp',import.meta.url));
  const beginner = await stat(new URL('../book-beginner.webp',import.meta.url));
  assert.ok(profit.size > 25_000);
  assert.ok(beginner.size > 50_000);
});

test('Lava API key never appears in browser scripts or markup', async () => {
  for (const path of ['book.html','book-checkout.js']) {
    const source = await readFile(new URL('../'+path,import.meta.url),'utf8');
    assert.doesNotMatch(source,/LAVA_TOP_API_KEY|LAVA_TOP_WEBHOOK_KEY|REDACTED_KEY_SHOULD_NOT_APPEAR/);
  }
});

test('invoice status reads official v1 API, webhook has server-only header authentication', async () => {
  const status = await readFile(new URL('../api/lava/status.js',import.meta.url),'utf8');
  const tags = await readFile(new URL('../api/lava/order-tags.js',import.meta.url),'utf8');
  const webhook = await readFile(new URL('../api/lava/webhook.js',import.meta.url),'utf8');
  assert.match(tags,/\/api\/v1\/invoices\//);
  assert.match(status,/tagPaidInvoice/);
  assert.match(webhook,/timingSafeEqual/);
  assert.match(webhook,/x-api-key/);
  assert.match(webhook,/payment\.success/);
});

test('payment tag maps to the right book, and only verified success qualifies', async () => {
  const { TAG_BY_BOOK, invoicePaid, invoiceMatchesOrder, emailDigest } = await import('../api/lava/order-tags.js');
  assert.equal(TAG_BY_BOOK.profit, 'Купил книгу 1');
  assert.equal(TAG_BY_BOOK.beginner, 'Купил книгу 2');
  for (const status of ['FAILED', 'PENDING', 'CANCELLED', 'REFUNDED']) {
    assert.equal(invoicePaid({status}), false);
  }
  assert.equal(invoicePaid({status:'SUCCESS'}), true);
  const order={offer_id:'12345678-1111-4111-8111-1234567890ab', email_sha256:emailDigest('buyer@example.com')};
  assert.equal(invoiceMatchesOrder({offerId:order.offer_id,buyer:{email:'Buyer@Example.com'}},order),true);
  assert.equal(invoiceMatchesOrder({offerId:'bad',buyer:{email:'Buyer@Example.com'}},order),false);
});
test('checkout authenticates buyer using short-lived server cookie, not user-supplied ID', async () => {
  const { makeCheckoutCookie, readCheckoutIdentity } = await import('../api/lava/session.js');
  const now = Date.UTC(2026,9,15,9,0,0);
  const secret = 'test-not-an-actual-bot-token';
  const cookie=makeCheckoutCookie('123456789',secret,now);
  assert.equal(readCheckoutIdentity('irina_book_auth='+cookie,secret,now+1000),'123456789');
  assert.equal(readCheckoutIdentity('irina_book_auth='+cookie,secret,now+20000000),null);
  assert.equal(readCheckoutIdentity('irina_book_auth='+cookie,secret+'wrong',now+1000),null);
});
