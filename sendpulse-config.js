const SENDPULSE_BOT_ID = '6671465ac84ab24b4702fa25';
const SENDPULSE_BASE = 'https://api.sendpulse.com/telegram';
const CONFIG_NOTE_PREFIX = 'IRINA_RUNTIME_CONFIG_V1:';
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
    const error = new Error(`sendpulse_${response.status}`);
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
  if (!text.startsWith(CONFIG_NOTE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(CONFIG_NOTE_PREFIX.length));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function findLatestConfigNote(notes = []) {
  return [...notes]
    .filter((note) => noteText(note).startsWith(CONFIG_NOTE_PREFIX))
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))[0] || null;
}

export async function loadStoredRuntimeConfig(apiKey) {
  if (!apiKey) return null;
  const contact = await getContactByTelegramId(ADMIN_TELEGRAM_ID, apiKey);
  if (!contact?.id) return null;
  const notes = await getConfigNotes(contact.id, apiKey);
  const note = findLatestConfigNote(notes);
  return note ? parseConfigNote(note) : null;
}

export async function saveStoredRuntimeConfig(config, apiKey) {
  const contact = await getContactByTelegramId(ADMIN_TELEGRAM_ID, apiKey);
  if (!contact?.id) throw new Error('admin_contact_not_found');

  const notes = await getConfigNotes(contact.id, apiKey);
  const existing = findLatestConfigNote(notes);
  const text = `${CONFIG_NOTE_PREFIX}${JSON.stringify(config)}`;
  const baseBody = {
    contact_id: String(contact.id),
    bot_id: SENDPULSE_BOT_ID,
    text,
  };

  if (existing?.id) {
    const payload = await sendPulseRequest('/contacts/updateNote', apiKey, {
      method: 'POST',
      body: JSON.stringify({ ...baseBody, note_id: String(existing.id) }),
    });
    return { noteId: String(existing.id), created: false, payload };
  }

  const payload = await sendPulseRequest('/contacts/createNote', apiKey, {
    method: 'POST',
    body: JSON.stringify(baseBody),
  });
  const noteId = String(payload?.id ?? payload?.data?.id ?? '');
  return { noteId, created: true, payload };
}

export { CONFIG_NOTE_PREFIX, SENDPULSE_BOT_ID };
