import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RELEASE } from '../release.js';
import { mergeRuntimeConfig } from '../runtime-config.js';
import { CONFIG_NOTE_PREFIX, findLatestConfigNote, parseConfigNote } from '../sendpulse-config.js';
import { nextConfigVersion } from '../api/admin-config.js';

test('starts public app release numbering at v.01', () => {
  assert.equal(APP_RELEASE, 'v.01');
});

test('runtime config merges version, colors and resource order safely', () => {
  const config = mergeRuntimeConfig({
    version: 7,
    ui: {
      accent: '#112233',
      accentSecondary: '#abcdef',
      resourceOrder: ['book', 'about'],
      showFreshness: false,
      animations: false,
    },
  });

  assert.equal(config.version, 7);
  assert.equal(config.ui.accent, '#112233');
  assert.equal(config.ui.accentSecondary, '#abcdef');
  assert.deepEqual(config.ui.resourceOrder, ['book', 'about', 'recruitment', 'trustedBy', 'mentor']);
  assert.equal(config.ui.showFreshness, false);
  assert.equal(config.ui.animations, false);
});

test('runtime config rejects unsafe colors and invalid versions', () => {
  const config = mergeRuntimeConfig({ version: 0, ui: { accent: 'red' } });
  assert.equal(config.version, 1);
  assert.equal(config.ui.accent, '#347ef4');
});

test('admin config version always moves forward', () => {
  assert.equal(nextConfigVersion(1), 2);
  assert.equal(nextConfigVersion(12), 13);
  assert.equal(nextConfigVersion('bad'), 2);
});

test('SendPulse config note parser reads only prefixed JSON and picks latest note', () => {
  const older = {
    id: '1',
    created_at: '2026-09-22T08:00:00Z',
    data: { text: `${CONFIG_NOTE_PREFIX}{"version":2}` },
  };
  const newer = {
    id: '2',
    created_at: '2026-09-22T09:00:00Z',
    data: { text: `${CONFIG_NOTE_PREFIX}{"version":3,"ui":{"accent":"#112233"}}` },
  };
  const unrelated = { id: '3', created_at: '2026-09-22T10:00:00Z', data: { text: 'обычная заметка' } };

  assert.equal(findLatestConfigNote([older, unrelated, newer])?.id, '2');
  assert.deepEqual(parseConfigNote(newer), { version: 3, ui: { accent: '#112233' } });
  assert.equal(parseConfigNote(unrelated), null);
});
