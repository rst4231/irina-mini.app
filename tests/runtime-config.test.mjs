import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RELEASE } from '../release.js';
import { mergeRuntimeConfig } from '../runtime-config.js';

test('internal release is v.20', () => {
  assert.equal(APP_RELEASE, 'v.20');
});

test('runtime config still supports feature switches and UI settings', () => {
  const config = mergeRuntimeConfig({
    version: 7,
    features: { recruitment: false, about: true },
    ui: {
      accent: '#112233',
      accentSecondary: '#abcdef',
      resourceOrder: ['book', 'about'],
      showFreshness: false,
      animations: false,
    },
  });

  assert.equal(config.version, 7);
  assert.equal(config.features.recruitment, false);
  assert.equal(config.features.about, true);
  assert.equal(config.ui.accent, '#112233');
  assert.equal(config.ui.accentSecondary, '#abcdef');
  assert.deepEqual(config.ui.resourceOrder, ['book', 'about', 'recruitment', 'trustedBy', 'mentor']);
  assert.equal(config.ui.showFreshness, false);
  assert.equal(config.ui.animations, false);
});

test('runtime config rejects unsafe colors and invalid versions', () => {
  const config = mergeRuntimeConfig({ version: 0, ui: { accent: 'red' } });
  assert.equal(config.version, 2);
  assert.equal(config.ui.accent, '#347ef4');
});
