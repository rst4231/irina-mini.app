import test from 'node:test';
import assert from 'node:assert/strict';

test('provider prices are read only from the requested product and validated currencies',async()=>{
 const api=await import('../api/book-prices.js').catch(()=>null);
 assert.ok(api?.readProductPrices,'price parser is available');
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',productID:'profit-id',offers:[{priceSpecification:{price:690,priceCurrency:'RUB'}},{priceSpecification:{price:8.28,priceCurrency:'USD'}}]})+'</script>';
 assert.deepEqual(api.readProductPrices(html),{rub:690,usd:8.28});
 assert.equal(api.readProductPrices('<p>"price":1,"priceCurrency":"USD"</p>'),null);
 assert.equal(api.readProductPrices('<script type="application/ld+json">{"offers":{"priceSpecification":{"price":-3,"priceCurrency":"USD"}}}</script>'),null);
});
test('Lava structured data supports its actual top-level Product array',async()=>{
 const {readProductPrices}=await import('../api/book-prices.js');
 const html='<script id="json-ld" type="application/ld+json">[{"@type":"Product","offers":{"priceSpecification":{"price":690,"priceCurrency":"RUB"}}},{"@type":"Product","offers":{"priceSpecification":{"price":8.28,"priceCurrency":"USD"}}}]</script>';
 assert.deepEqual(readProductPrices(html),{rub:690,usd:8.28});
});
