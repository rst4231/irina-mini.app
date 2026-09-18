import crypto from 'node:crypto';

const SENDPULSE_BOT_ID = '6671465ac84ab24b4702fa25';
const SENDPULSE_BASE = 'https://api.sendpulse.com/telegram';
const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 21600;
const MAX_FUTURE_SKEW_SECONDS = 60;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function validateInitData(initData, botToken, options = {}) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const receivedBuffer = Buffer.from(hash, 'hex');
  const calculatedBuffer = Buffer.from(calculated, 'hex');
  if (receivedBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, calculatedBuffer)) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Number.isFinite(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  const configuredMaxAge = Number(options.maxAgeSeconds);
  const maxAgeSeconds = Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
    ? configuredMaxAge
    : DEFAULT_INIT_DATA_MAX_AGE_SECONDS;

  if (!Number.isInteger(authDate)) return null;
  const ageSeconds = nowSeconds - authDate;
  if (ageSeconds > maxAgeSeconds || ageSeconds < -MAX_FUTURE_SKEW_SECONDS) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

function tagNames(tags) {
  if (!Array.isArray(tags)) return new Set();
  return new Set(tags.map((tag) => {
    if (typeof tag === 'string') return tag.trim();
    return String(tag?.name ?? tag?.title ?? tag?.tag ?? '').trim();
  }).filter(Boolean));
}

function variableValue(variables, name) {
  if (!variables) return '';
  if (!Array.isArray(variables) && typeof variables === 'object') {
    const value = variables[name];
    if (value && typeof value === 'object' && 'value' in value) return String(value.value ?? '').trim();
    return String(value ?? '').trim();
  }
  if (Array.isArray(variables)) {
    const item = variables.find((entry) => String(entry?.name ?? entry?.variable_name ?? '').trim() === name);
    return String(item?.value ?? item?.variable_value ?? '').trim();
  }
  return '';
}

async function getSendPulseContact(telegramId, apiKey) {
  const url = new URL(`${SENDPULSE_BASE}/contacts/getByTelegramId`);
  url.searchParams.set('bot_id', SENDPULSE_BOT_ID);
  url.searchParams.set('telegram_id', String(telegramId));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`sendpulse_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) return payload.data;
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const sendPulseApiKey = process.env.SENDPULSE_API_KEY;
  if (!botToken || !sendPulseApiKey) {
    return json(res, 503, { ok: false, error: 'service_not_configured' });
  }

  const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
  if (!initData) return json(res, 400, { ok: false, error: 'missing_init_data' });

  const maxAgeFromEnv = Number(process.env.INIT_DATA_MAX_AGE_SECONDS);
  const maxAgeSeconds = Number.isFinite(maxAgeFromEnv) && maxAgeFromEnv > 0
    ? maxAgeFromEnv
    : DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
  const user = validateInitData(initData, botToken, { maxAgeSeconds });
  if (!user?.id) return json(res, 401, { ok: false, error: 'invalid_or_stale_init_data' });

  try {
    const contact = await getSendPulseContact(user.id, sendPulseApiKey);
    const tags = tagNames(contact?.tags);
    const hasPaymentTag = tags.has('Оплата');
    const receivedTerms = hasPaymentTag || tags.has('Получил условия');
    const applicationApproved = receivedTerms || tags.has('Одобрен');
    const applicationCompleted = applicationApproved || tags.has('Заполнил');

    return json(res, 200, {
      ok: true,
      sendPulseName: variableValue(contact?.variables, 'NAME'),
      applicationCompleted,
      applicationApproved,
      receivedTerms,
      hasPaymentTag,
    });
  } catch (error) {
    console.error('profile_error', error?.message || error);
    return json(res, 502, { ok: false, error: 'sendpulse_unavailable' });
  }
}
