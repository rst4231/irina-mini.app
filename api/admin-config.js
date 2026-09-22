import { validateInitData } from './profile.js';
import { loadRuntimeConfig } from './config.js';
import { mergeRuntimeConfig } from '../runtime-config.js';
import { ADMIN_TELEGRAM_ID, saveStoredRuntimeConfig } from '../sendpulse-config.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body !== 'string' || !body.trim()) return {};
  try { return JSON.parse(body); } catch { return {}; }
}

export function isAdminTelegramUser(user) {
  return String(user?.id || '') === ADMIN_TELEGRAM_ID;
}

function authorize(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, status: 503, error: 'service_not_configured' };

  const body = parseBody(req.body);
  const headerInitData = typeof req.headers?.['x-telegram-init-data'] === 'string'
    ? req.headers['x-telegram-init-data']
    : '';
  const initData = typeof body.initData === 'string' && body.initData ? body.initData : headerInitData;
  if (!initData) return { ok: false, status: 401, error: 'missing_init_data' };

  const user = validateInitData(initData, botToken);
  if (!user?.id) return { ok: false, status: 401, error: 'invalid_or_stale_init_data' };
  if (!isAdminTelegramUser(user)) return { ok: false, status: 403, error: 'forbidden' };

  return { ok: true, body, user };
}

export function nextConfigVersion(currentVersion) {
  const version = Number(currentVersion);
  return Number.isInteger(version) && version >= 1 ? version + 1 : 2;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const auth = authorize(req);
  if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });

  const sendPulseApiKey = process.env.SENDPULSE_API_KEY;
  if (!sendPulseApiKey) return json(res, 503, { ok: false, error: 'storage_not_configured' });

  try {
    const current = await loadRuntimeConfig();

    if (req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        admin: true,
        config: current,
      });
    }

    const incoming = auth.body?.config;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return json(res, 400, { ok: false, error: 'invalid_config' });
    }

    const next = mergeRuntimeConfig(incoming);
    next.version = nextConfigVersion(current.version);
    const storage = await saveStoredRuntimeConfig(next, sendPulseApiKey);

    return json(res, 200, {
      ok: true,
      config: next,
      storage: {
        noteId: storage.noteId || null,
        created: Boolean(storage.created),
      },
    });
  } catch (error) {
    console.error('admin_config_error', error?.message || error);
    return json(res, 502, { ok: false, error: 'admin_config_unavailable' });
  }
}
