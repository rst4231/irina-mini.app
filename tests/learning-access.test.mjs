import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRuntimeConfig} from '../runtime-config.js';
test('free theory is available and practice is hidden by default',()=>{
 const defaults=mergeRuntimeConfig();
 assert.equal(defaults.features.theory,true);
 assert.equal(defaults.features.practice,false);
 assert.match(defaults.links.theory,/\/theory$/);
});
