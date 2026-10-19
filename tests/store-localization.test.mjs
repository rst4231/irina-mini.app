import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedTranslation} from '../cloudflare/irina-store-d1-worker.js';

test('Thai ADSPLUS titles are localized without losing technical markers',()=>{
  const source='บัญชี Facebook CLONE | HOTMAIL | เปิด 2FA | อายุ 1-2 ปี | UID 6157';
  const translated='Аккаунт Facebook CLONE; HOTMAIL; 2FA включена; возраст 1–2 года; UID 6157';
  assert.equal(normalizedTranslation(source,translated),'Аккаунт Facebook CLONE | HOTMAIL | 2FA включена | возраст 1–2 года | UID 6157');
});
test('Translation normalization rejects untranslated Thai and keeps mandatory IDs',()=>{
  assert.equal(normalizedTranslation('บัญชี Facebook','บัญชี Facebook'),null);
  assert.equal(normalizedTranslation('บัญชี Facebook | UID 6157 | 2FA','Facebook account'),'Facebook account | UID 6157 | 2FA');
  assert.equal(normalizedTranslation('บัญชี Facebook',''),null);
});
