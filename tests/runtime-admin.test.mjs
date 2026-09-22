import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RELEASE } from '../release.js';
import { mergeRuntimeConfig } from '../runtime-config.js';
import {
  CONFIG_CHUNK_SIZE,
  CONFIG_NOTE_PREFIX,
  LEGACY_CONFIG_NOTE_PREFIX,
  encodeConfigChunks,
  findChunkedConfigByStorageId,
  findLatestChunkedConfig,
  findLatestConfigNote,
  parseConfigChunk,
  parseConfigNote,
} from '../sendpulse-config.js';
import { isAdminTelegramUser, nextConfigVersion } from '../api/admin-config.js';

test('increments public app release to v.03 for verified admin persistence', () => {
  assert.equal(APP_RELEASE, 'v.03');
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

test('legacy SendPulse config notes remain readable', () => {
  const older = {
    id: '1',
    created_at: '2026-09-22T08:00:00Z',
    data: { text: `${LEGACY_CONFIG_NOTE_PREFIX}{"version":2}` },
  };
  const newer = {
    id: '2',
    created_at: '2026-09-22T09:00:00Z',
    data: { text: `${LEGACY_CONFIG_NOTE_PREFIX}{"version":3,"ui":{"accent":"#112233"}}` },
  };
  const unrelated = { id: '3', created_at: '2026-09-22T10:00:00Z', data: { text: 'обычная заметка' } };

  assert.equal(findLatestConfigNote([older, unrelated, newer])?.id, '2');
  assert.deepEqual(parseConfigNote(newer), { version: 3, ui: { accent: '#112233' } });
  assert.equal(parseConfigNote(unrelated), null);
});

test('large runtime config is split into short SendPulse notes and reconstructed losslessly', () => {
  const config = {
    version: 12,
    copy: {
      description: 'тест '.repeat(900),
    },
    links: {
      example: 'https://example.com/path?x=1',
    },
  };
  const texts = encodeConfigChunks(config, '1790065000000');

  assert.ok(texts.length > 1);
  for (const text of texts) {
    assert.ok(text.length <= CONFIG_CHUNK_SIZE + CONFIG_NOTE_PREFIX.length + 40);
  }

  const notes = texts.map((text, index) => ({
    id: String(index + 1),
    created_at: `2026-09-22T10:00:0${index}Z`,
    data: { text },
  }));
  const first = parseConfigChunk(notes[0]);
  assert.equal(first.storageId, '1790065000000');
  assert.equal(first.index, 1);
  assert.equal(first.total, notes.length);

  const reconstructed = findLatestChunkedConfig(notes);
  assert.deepEqual(reconstructed?.config, config);
  const exact = findChunkedConfigByStorageId(notes, '1790065000000');
  assert.deepEqual(exact?.config, config);
  assert.equal(findChunkedConfigByStorageId(notes, 'missing'), null);
});

test('admin access is limited to the configured Telegram ID', () => {
  assert.equal(isAdminTelegramUser({ id: 160628165 }), true);
  assert.equal(isAdminTelegramUser({ id: 160628166 }), false);
  assert.equal(isAdminTelegramUser(null), false);
});
