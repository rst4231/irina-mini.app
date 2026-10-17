import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningCookie,verifyLearningCookie,getLearningCookieValue,extractLearningCookieHeader} from '../api/learning-cookie.js';
import fs from 'node:fs/promises';

test('session accepts a valid signed Telegram id and preserves 6 hour secure cookie',()=>{
  const now=1_792_240_000;
  const cookie=createLearningCookie('10203040','bot_secret',now);
  assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
  assert.deepEqual(verifyLearningCookie(cookie,'bot_secret',now+25),{id:'10203040'});
  assert.match(extractLearningCookieHeader(cookie),/^__Host-irina-learning=/);
});

test('learning cookie cannot be forged by changing ID or using the wrong secret',()=>{
  const now=1_792_240_000;
  const cookie=createLearningCookie('10203040','secret-a',now);
  const token=getLearningCookieValue(cookie);
  assert.equal(verifyLearningCookie('__Host-irina-learning='+token,'secret-b',now),null);
  const [payload,signature]=token.split('.');
  const altered=Buffer.from(JSON.stringify({id:'99999999',exp:now+100})).toString('base64url');
  assert.equal(verifyLearningCookie('__Host-irina-learning='+altered+'.'+signature,'secret-a',now),null);
  assert.equal(verifyLearningCookie('__Host-irina-learning=garbage','secret-a',now),null);
});

test('cookie expires after 6 hours and never validates without bot secret',()=>{
  const now=1_792_240_000;
  const cookie=createLearningCookie('10203040','bot_secret',now);
  assert.equal(verifyLearningCookie(cookie,'bot_secret',now+6*3600),null);
  assert.equal(verifyLearningCookie(cookie,'',now),null);
  assert.equal(verifyLearningCookie('', 'bot_secret',now),null);
});

test('paid users hide both beginner learning buttons, regardless of application rejection',async()=>{
  const app=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/const hasPaidTraining = Boolean\(lastProfileData\?\.hasPaymentTag\)/);
  assert.match(app,/theoryButton\.hidden = hasPaidTraining/);
  assert.match(app,/practiceButton\.hidden = hasPaidTraining/);
});

test('paid lesson authentication keeps Telegram ID verification and matching SendPulse tag',async()=>{
  const auth=await fs.readFile(new URL('../api/learning-authorize.js',import.meta.url),'utf8');
  const worker=await fs.readFile(new URL('../cloudflare/irina-learning-api.js',import.meta.url),'utf8');
  assert.match(auth,/verifyLearningCookie/);
  assert.match(auth,/grantsLearningAccess\(contact\?\.tags\|\|\[\],section\)/);
  assert.match(worker,/AUTH_URL/);
  assert.match(worker,/Cookie:session/);
  assert.doesNotMatch(worker,/return reply\(200,\{ok:true,lesson\}\);\s*\/\//);
});

test('lesson titles, numbers and article links have no distracting underlines',async()=>{
  const css=await fs.readFile(new URL('../learning.css',import.meta.url),'utf8');
  assert.match(css,/\.learning-wrap \.lesson-list a\.lesson-row/);
  assert.match(css,/\.learning-wrap \.lesson-list a\.lesson-row \*/);
  assert.match(css,/\.learning-wrap \.lesson-prose a[^{]*\{[^}]*text-decoration:\s*none/s);
});
