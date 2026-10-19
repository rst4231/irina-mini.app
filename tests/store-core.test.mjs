import test from 'node:test';
import assert from 'node:assert/strict';
import {currency,moneyToCents,sellPrice,validEmail,validWallet,sha256,equalsSecret,encryptDelivery,decryptDelivery} from '../lib/store/core.js';
import {normalizeListing,isMetaAccountCategory,syncBatch,getMetaCategories} from '../lib/store/supplier.js';
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
  const forged=cipher.replace(/.$/, c=>c==='A'?'B':'A');
  assert.throws(()=>decryptDelivery(forged));
  delete process.env.STORE_DELIVERY_ENCRYPTION_KEY;
});
test('supplier field mapping matches ADSPLUS v3 documentation',()=>{
  const p=normalizeListing({product:123,name:'Facebook 1yr+',price:'4.25',currency:'THB',stock:12,category:'Facebook',min:1,max:50});
  assert.equal(p.provider_listing_id,123);
  assert.equal(p.supplier_price_cents,425);
  assert.equal(p.stock,12);
  assert.equal(p.title,'Facebook 1yr+');
});

test('Meta inventory includes personal profiles, excludes services and non-Meta accounts',()=>{
  for(const category of ['Facebook Accounts','Instagram Accounts','Meta Business Manager','Threads Accounts','Facebook personal profiles','WhatsApp Business Accounts']) assert.equal(isMetaAccountCategory(category),true,category);
  for(const category of ['Gmail Accounts','Telegram Accounts','MetaMask Wallets','Instagram Followers Service','TikTok Accounts']) assert.equal(isMetaAccountCategory(category),false,category);
});
test('Meta catalog sync walks all eligible categories and ignores unrelated results',async()=>{
  const original=globalThis.fetch, oldKey=process.env.STORE_ADSPLUS_API_KEY;
  process.env.STORE_ADSPLUS_API_KEY='adp_'+'a'.repeat(50);
  globalThis.fetch=async (url,request)=>{
    const action=String(url).split('/').at(-1);
    const input=JSON.parse(request.body);
    const data=action==='categories'?{categories:[{category:22,name:'Facebook Accounts'},{category:23,name:'Gmail Accounts'},{category:24,name:'Instagram Accounts'}]}:{products:[{product:1,name:'My personal profile',price:'2.00',currency:'THB',stock:4,category:'Facebook Accounts',min:1,max:10},{product:2,name:'Email',price:'0.40',currency:'THB',stock:4,category:'Gmail Accounts',min:1,max:10}],pages:1};
    return {ok:true,json:async()=>({ok:true,data})};
  };
  try{
    assert.deepEqual((await getMetaCategories()).map(x=>x.id),[22,24]);
    const sync=await syncBatch(22,1,1);
    assert.equal(sync.items.length,1);
    assert.equal(sync.items[0].title,'My personal profile');
  }finally{globalThis.fetch=original;if(oldKey===undefined)delete process.env.STORE_ADSPLUS_API_KEY;else process.env.STORE_ADSPLUS_API_KEY=oldKey}
});
