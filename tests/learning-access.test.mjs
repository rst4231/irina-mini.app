import test from 'node:test';
import assert from 'node:assert/strict';
import {grantsLearningAccess,SECTION_TAGS} from '../api/learning-authorize.js';
import {mergeRuntimeConfig} from '../runtime-config.js';

test('paid lessons require a matching confirmed-purchase tag',()=>{
  assert.equal(grantsLearningAccess(['Практика: Креативы'],'creatives'),true);
  assert.equal(grantsLearningAccess([{name:'Практика: Keitaro'}],'keitaro'),true);
  assert.equal(grantsLearningAccess(['Практика: Креативы'],'keitaro'),false);
  assert.equal(grantsLearningAccess(['Оплата'],'launch'),false);
  assert.equal(grantsLearningAccess([],'launch'),false);
  assert.equal(grantsLearningAccess(['Практика: Все'],'launch'),true);
  assert.equal(grantsLearningAccess(['Практика: Полный комплект'],'infrastructure'),true);
  assert.equal(grantsLearningAccess(['Практика: Все'],'unexpected'),false);
});

test('all four products have unique access tags',()=>{
  assert.deepEqual(Object.keys(SECTION_TAGS).sort(),['creatives','infrastructure','keitaro','launch']);
  assert.equal(new Set(Object.values(SECTION_TAGS)).size,4);
});

test('learning entries are enabled by default and configurable without redeploy',()=>{
  const defaults=mergeRuntimeConfig();
  assert.equal(defaults.features.theory,true);
  assert.equal(defaults.features.practice,true);
  assert.match(defaults.links.theory,/\/theory$/);
  assert.match(defaults.links.practice,/\/practice$/);
  const configured=mergeRuntimeConfig({features:{practice:false},copy:{theoryTitle:'База'}});
  assert.equal(configured.features.practice,false);
  assert.equal(configured.copy.theoryTitle,'База');
});
