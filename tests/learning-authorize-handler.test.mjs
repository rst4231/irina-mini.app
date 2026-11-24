import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/learning-authorize.js';
test('disabled paid learning never reaches an external authorization service or grants access',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network request');});
  for(const section of ['all','creatives','infrastructure','keitaro','launch']){
    const res={setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'POST',body:{section,initData:'signed-data'},headers:{}},res);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.error,'purchase_required');
  }
  assert.equal(globalThis.fetch.mock.calls.length,0);
});
