import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RELEASE } from '../release.js';
import { mergeRuntimeConfig } from '../runtime-config.js';

test('internal release is v.21', () => {
  assert.equal(APP_RELEASE, 'v.21');
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
  assert.deepEqual(config.ui.resourceOrder, ['book', 'about', 'recruitment', 'theory', 'practice', 'trustedBy', 'mentor']);
  assert.equal(config.ui.showFreshness, false);
  assert.equal(config.ui.animations, false);
});

test('runtime config rejects unsafe colors and invalid versions', () => {
  const config = mergeRuntimeConfig({ version: 0, ui: { accent: 'red' } });
  assert.equal(config.version, 2);
  assert.equal(config.ui.accent, '#347ef4');
});

test('home recruitment and account store text live in runtime config', () => {
  const current=mergeRuntimeConfig();
  assert.equal(current.copy.recruitmentTitle,'Набор в команду');
  assert.equal(current.copy.storeTitle,'Магазин аккаунтов');
  assert.equal(current.copy.storeSubtitle,'Аккаунты для рекламы');
  const changed=mergeRuntimeConfig({copy:{storeSubtitle:'Новые аккаунты',storeTitle:'Каталог'}});
  assert.equal(changed.copy.storeSubtitle,'Новые аккаунты');
  assert.equal(changed.copy.storeTitle,'Каталог');
});
