import test from 'node:test';
import assert from 'node:assert/strict';
import {currency,moneyToCents,sellPrice,validEmail,validWallet,sha256,equalsSecret,encryptDelivery,decryptDelivery} from '../lib/store/core.js';
import {normalizeListing} from '../lib/store/supplier.js';
test('money pricing preserves cents and rounds up markup',()=>{
  assert.equal(moneyToCents('0.10'),10);
  assert.equal(moneyToCents('2'),200);
  assert.equal(sellPrice(119,45),173);
  assert.equal(currency(173),1.73);
  assert.throws(()=>moneyToCents('12.001'));
  assert.throws(()=>sellPrice(100,-1));
});
test('contact and wallet validation',()=>{
  assert.equal(validEmail('hello@example.com'),true);
  assert.equal(validEmail('anything'),false);
  assert.equal(validWallet('TLEYJyCMjPjNXy3jFiyAfwTwXvgRuQY4VW'),true);
  assert.equal(validWallet('0x123'),false);
});
test('lookup token hash equality',()=>{
  assert.equal(equalsSecret(sha256('secret'),sha256('secret')),true);
  assert.equal(equalsSecret(sha256('secret'),sha256('other')),false);
});
test('delivery encrypted at rest with authenticated decryption',()=>{
  process.env.STORE_DELIVERY_ENCRYPTION_KEY='0123456789abcdef'.repeat(4);
  const original=['test-user:private', 'another-user:secret'];
  const cipher=encryptDelivery(original);
  assert.ok(!cipher.includes('private'));
  assert.deepEqual(decryptDelivery(cipher),original);
  // Modify an authenticated tag byte, not the last base64url character whose unused bits may decode identically.
  const parts=cipher.split('.');
  parts[1]=(parts[1][0]==='A'?'B':'A')+parts[1].slice(1);
  assert.throws(()=>decryptDelivery(parts.join('.')));
  delete process.env.STORE_DELIVERY_ENCRYPTION_KEY;
});
test('supplier field mapping matches current AccsZone documentation',()=>{
  const p=normalizeListing({id:123,slug:'example-slug',title:'<b>Test</b>',price:'4.25',available_stock:12,category:{title:'Facebook'}});
  assert.equal(p.provider_listing_id,123);
  assert.equal(p.supplier_price_cents,425);
  assert.equal(p.stock,12);
  assert.equal(p.title,'Test');
});
