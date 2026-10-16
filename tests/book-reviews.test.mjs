import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { needsBookReviewModeration, safeTelegramPhoto } from '../api/book-reviews.js';
const src = (name) => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('negative comments and low star ratings go to moderation', () => {
  assert.equal(needsBookReviewModeration(1, 'Хорошая книга'), true);
  assert.equal(needsBookReviewModeration(2, 'Хорошая книга'), true);
  assert.equal(needsBookReviewModeration(3, 'Хорошая книга'), true);
  assert.equal(needsBookReviewModeration(5, 'Полностью бесполезное руководство'), true);
  assert.equal(needsBookReviewModeration(4, 'Не рекомендую эту книгу'), true);
  assert.equal(needsBookReviewModeration(5, 'Содержательный материал, помогла разобраться'), false);
  assert.equal(needsBookReviewModeration(4, 'Полезная структура и понятные шаги'), false);
  assert.equal(needsBookReviewModeration(5, 'https://spam.example'), true);
});
test('Telegram photos require HTTPS', () => {
  assert.equal(safeTelegramPhoto('https://t.me/i/userpic/320/user.jpg'), 'https://t.me/i/userpic/320/user.jpg');
  assert.equal(safeTelegramPhoto('javascript:alert(1)'), null);
  assert.equal(safeTelegramPhoto('http://bad.example/photo'), null);
});
test('reviews have 1–5 stars, split per book, and rating stickers on both covers', async () => {
  const html = await src('book.html');
  const js = await src('book-reviews.js');
  assert.match(html, /data-rating-badge="profit"/);
  assert.match(html, /data-rating-badge="beginner"/);
  for (const i of [1,2,3,4,5]) assert.match(html, new RegExp('data-review-rating="' + i + '"'));
  assert.match(html, /data-review-tab="profit"/);
  assert.match(html, /data-review-tab="beginner"/);
  assert.match(js, /data\.stats/);
  assert.match(js, /data-rating-average/);
  assert.match(js, /function renderRatings/);
});
test('reviews collapse to three lines and can expand', async () => {
  const html = await src('book.html');
  const js = await src('book-reviews.js');
  assert.match(html, /-webkit-line-clamp:3/);
  assert.match(js, /Читать полностью/);
  assert.match(js, /Свернуть/);
  assert.match(js, /review-text is-collapsed/);
});
test('Telegram identity is verified server-side and names are optional in Mini App', async () => {
  const api = await src('api/book-reviews.js');
  const js = await src('book-reviews.js');
  assert.match(api, /validateInitData\(initData, token\)/);
  assert.match(api, /safeTelegramPhoto\(user\.photo_url\)/);
  assert.match(js, /nameField\.hidden = true/);
  assert.match(js, /nameInput\.required = false/);
  assert.match(js, /isTelegram\?'':nameInput\.value/);
  assert.match(js, /review-avatar/);
});
test('negative submissions show moderation message; only Telegram admin can approve', async () => {
  const js = await src('book-reviews.js');
  const admin = await src('api/book-reviews-admin.js');
  const store = await src('cloudflare/irina-book-reviews-d1.js');
  assert.match(js, /Ваш отзыв отправлен на модерацию/);
  assert.match(admin, /validateInitData/);
  assert.match(admin, /160628165/);
  assert.match(store, /status='pending'/);
  assert.match(store, /moderated_at/);
});
test('review scores count submitted ratings including pending but exclude rejected and unrated', async () => {
  const source = await src('cloudflare/irina-book-reviews-d1.js');
  assert.match(source, /COUNT\(rating\)/);
  assert.match(source, /status IN \('published','pending'\) AND rating IS NOT NULL/);
  assert.match(source, /SELECT id, book_key, rating/);
});
test('reviews only use dedicated D1 storage and do not alter external Lava purchasing', async () => {
  const api = await src('lib/book-review-store.js');
  const html = await src('book.html');
  assert.match(api, /BOOK_REVIEWS_D1_URL/);
  assert.match(api, /BOOK_REVIEWS_D1_TOKEN/);
  assert.doesNotMatch(api, /neon|BOOK_ORDERS_DATABASE_URL/i);
  assert.match(html, /href="https:\/\/app\.lava\.top\/products\/1a995492-be5d-4957-8dfb-29bb21d7f387"/);
  assert.match(html, /href="https:\/\/app\.lava\.top\/products\/cfdceb95-cf9d-49d6-babc-736ade4edbc6"/);
  assert.match(html, /data-external-purchase="profit"/);
  assert.match(html, /data-external-purchase="beginner"/);
});
