import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { injectBuildinBridge, normalizeBuildinUrl } from '../buildin-proxy.js';

test('proxy only accepts HTTPS Buildin URLs', () => {
  assert.equal(normalizeBuildinUrl('https://buildin.ai/abc'), 'https://buildin.ai/abc');
  assert.equal(normalizeBuildinUrl('https://sub.buildin.ai/abc'), 'https://sub.buildin.ai/abc');
  assert.equal(normalizeBuildinUrl('http://buildin.ai/abc'), null);
  assert.equal(normalizeBuildinUrl('https://example.com/abc'), null);
});

test('proxy injects navigation bridge that traps Buildin links and window.open', () => {
  const html='<html><head><title>x</title></head><body><a href="/next" target="_blank">Next</a></body></html>';
  const out=injectBuildinBridge(html,'https://buildin.ai/current');
  assert.match(out,/data-buildin-location-bootstrap/);
  assert.match(out,/data-buildin-proxy-bridge/);
  assert.match(out,/buildin:navigate/);
  assert.match(out,/buildin:history-push/);
  assert.match(out,/buildin:history-replace/);
  assert.match(out,/window\.open=function/);
  assert.match(out,/hideBranding/);
  assert.match(out,/<base href="https:\/\/buildin\.ai\/current">/);
  const scripts=[...out.matchAll(/<script data-buildin-(?:location-bootstrap|proxy-bridge)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,2);
  for(const script of scripts)new vm.Script(script[1]);
});
