const SENDPULSE_BOT_ID = '6671465ac84ab24b4702fa25';
const SENDPULSE_BASE = 'https://api.sendpulse.com/telegram';
const LEGACY_CONFIG_NOTE_PREFIX = 'IRINA_RUNTIME_CONFIG_V1:';
const CONFIG_NOTE_PREFIX = 'IRINA_RUNTIME_CONFIG_V2:';
const CONFIG_CHUNK_SIZE = 700;
export const ADMIN_TELEGRAM_ID = '160628165';

async function sendPulseRequest(path, apiKey, options = {}) {
  const response = await fetch(`${SENDPULSE_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.error || payload?.data?.message || '';
    const error = new Error(`sendpulse_${response.status}${detail ? `_${String(detail).slice(0, 120)}` : ''}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function getContactByTelegramId(telegramId, apiKey) {
  const params = new URLSearchParams({
    bot_id: SENDPULSE_BOT_ID,
    telegram_id: String(telegramId),
  });
  const payload = await sendPulseRequest(`/contacts/getByTelegramId?${params}`, apiKey);
  return payload?.data || payload || null;
}

export async function getConfigNotes(contactId, apiKey) {
  const params = new URLSearchParams({
    bot_id: SENDPULSE_BOT_ID,
    contact_id: String(contactId),
  });
  const payload = await sendPulseRequest(`/contacts/notes?${params}`, apiKey);
  return Array.isArray(payload?.data) ? payload.data : [];
}

function noteText(note) {
  return String(note?.data?.text ?? note?.text ?? '').trim();
}

export function parseConfigNote(note) {
  const text = noteText(note);
  if (!text.startsWith(LEGACY_CONFIG_NOTE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(LEGACY_CONFIG_NOTE_PREFIX.length));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function findLatestConfigNote(notes = []) {
  return [...notes]
    .filter((note) => noteText(note).startsWith(LEGACY_CONFIG_NOTE_PREFIX))
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))[0] || null;
}

export function encodeConfigChunks(config, storageId = String(Date.now())) {
  const serialized = JSON.stringify(config);
  const chunks = [];
  for (let offset = 0; offset < serialized.length; offset += CONFIG_CHUNK_SIZE) {
    chunks.push(serialized.slice(offset, offset + CONFIG_CHUNK_SIZE));
  }
  const total = Math.max(1, chunks.length);
  if (!chunks.length) chunks.push('{}');
  return chunks.map((chunk, index) => `${CONFIG_NOTE_PREFIX}${storageId}:${index + 1}/${total}:${chunk}`);
}

export function parseConfigChunk(note) {
  const text = noteText(note);
  if (!text.startsWith(CONFIG_NOTE_PREFIX)) return null;
  const remainder = text.slice(CONFIG_NOTE_PREFIX.length);
  const firstColon = remainder.indexOf(':');
  const secondColon = remainder.indexOf(':', firstColon + 1);
  if (firstColon <= 0 || secondColon <= firstColon) return null;

  const storageId = remainder.slice(0, firstColon);
  const position = remainder.slice(firstColon + 1, secondColon);
  const match = position.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;

  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1 || index > total) return null;

  return {
    note,
    storageId,
    index,
    total,
    chunk: remainder.slice(secondColon + 1),
  };
}

export function findLatestChunkedConfig(notes = []) {
  const groups = new Map();

  for (const note of notes) {
    const parsed = parseConfigChunk(note);
    if (!parsed) continue;
    if (!groups.has(parsed.storageId)) {
      groups.set(parsed.storageId, { storageId: parsed.storageId, total: parsed.total, parts: new Map(), notes: [] });
    }
    const group = groups.get(parsed.storageId);
    if (group.total !== parsed.total) continue;
    group.parts.set(parsed.index, parsed.chunk);
    group.notes.push(note);
  }

  const complete = [...groups.values()]
    .filter((group) => group.parts.size === group.total && Array.from({ length: group.total }, (_, i) => group.parts.has(i + 1)))
    .sort((a, b) => {
      const numeric = Number(b.storageId) - Number(a.storageId);
      return Number.isFinite(numeric) && numeric !== 0 ? numeric : b.storageId.localeCompare(a.storageId);
    });

  for (const group of complete) {
    try {
      const serialized = Array.from({ length: group.total }, (_, i) => group.parts.get(i + 1)).join('');
      const config = JSON.parse(serialized);
      if (config && typeof config === 'object' && !Array.isArray(config)) return { config, group };
    } catch {}
  }

  return null;
}

async function createNote(contactId, text, apiKey) {
  return sendPulseRequest('/contacts/createNote', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      contact_id: String(contactId),
      bot_id: SENDPULSE_BOT_ID,
      text,
    }),
  });
}

async function deleteNote(contactId, noteId, apiKey) {
  if (!noteId) return null;
  return sendPulseRequest('/contacts/deleteNote', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      contact_id: String(contactId),
      bot_id: SENDPULSE_BOT_ID,
      note_id: String(noteId),
    }),
  }).catch(() => null);
}

export async function loadStoredRuntimeConfig(apiKey) {
  if (!apiKey) return null;
  const contact = await getContactByTelegramId(ADMIN_TELEGRAM_ID, apiKey);
  if (!contact?.id) return null;

  const notes = await getConfigNotes(contact.id, apiKey);
  const chunked = findLatestChunkedConfig(notes);
  if (chunked?.config) return chunked.config;

  const legacy = findLatestConfigNote(notes);
  return legacy ? parseConfigNote(legacy) : null;
}

export async function saveStoredRuntimeConfig(config, apiKey) {
  const contact = await getContactByTelegramId(ADMIN_TELEGRAM_ID, apiKey);
  if (!contact?.id) throw new Error('admin_contact_not_found');

  const existingNotes = await getConfigNotes(contact.id, apiKey);
  const storageId = String(Date.now());
  const texts = encodeConfigChunks(config, storageId);
  const createdIds = [];

  try {
    for (const text of texts) {
      const payload = await createNote(contact.id, text, apiKey);
      const noteId = String(payload?.id ?? payload?.data?.id ?? '');
      if (!noteId) throw new Error('sendpulse_note_id_missing');
      createdIds.push(noteId);
    }
  } catch (error) {
    await Promise.all(createdIds.map((noteId) => deleteNote(contact.id, noteId, apiKey)));
    throw error;
  }

  const oldConfigNotes = existingNotes.filter((note) => {
    const text = noteText(note);
    return text.startsWith(CONFIG_NOTE_PREFIX) || text.startsWith(LEGACY_CONFIG_NOTE_PREFIX);
  });
  await Promise.all(oldConfigNotes.map((note) => deleteNote(contact.id, note?.id, apiKey)));

  return {
    noteId: createdIds[0] || null,
    noteIds: createdIds,
    created: true,
    chunks: texts.length,
  };
}

export {
  CONFIG_CHUNK_SIZE,
  CONFIG_NOTE_PREFIX,
  LEGACY_CONFIG_NOTE_PREFIX,
  SENDPULSE_BOT_ID,
};
