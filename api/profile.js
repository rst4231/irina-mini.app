import crypto from 'node:crypto';
import { createLearningCookie } from './learning-cookie.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
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
  // Same-origin, HTTP-only identity ticket for navigating to paid lessons.
  res.setHeader('Set-Cookie', createLearningCookie(user.id, botToken));

  return json(res, 200, { ok: true });
}
