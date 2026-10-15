import crypto from 'node:crypto';
import { validateInitData } from '../profile.js';

const COOKIE = 'irina_book_auth';
const MAX_AGE = 4 * 60 * 60;
function sign(payload, token) {
  return crypto.createHmac('sha256', token).update('book-checkout-v1:' + payload).digest('base64url');
}
export function makeCheckoutCookie(telegramId, token, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    id: String(telegramId), exp: Math.floor(now / 1000) + MAX_AGE,
  })).toString('base64url');
  return payload + '.' + sign(payload, token);
}
export function readCheckoutIdentity(cookieHeader, token, now = Date.now()) {
  if (!token || typeof cookieHeader !== 'string') return null;
  const encoded = cookieHeader.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  if (!encoded) return null;
  const value = encoded.slice(COOKIE.length + 1);
  const parts = value.split('.');
  if (parts.length !== 2 || parts.some(x => x.length > 250)) return null;
  const expected = Buffer.from(sign(parts[0], token));
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const obj = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!/^\\d{1,18}$/.test(String(obj.id))) return null;
    if (!Number.isSafeInteger(obj.exp) || obj.exp < now / 1000 || obj.exp > now / 1000 + MAX_AGE + 60) return null;
    return obj.id;
  } catch { return null; }
}
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  const origin = req.headers.origin;
  if (origin && origin !== 'https://irina-miniapp.vercel.app') return res.status(403).json({ok:false,error:'invalid_origin'});
  const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const user = validateInitData(initData, token);
  if (!user?.id) return res.status(401).json({ok:false,error:'invalid_telegram_session'});
  res.setHeader('Set-Cookie', COOKIE + '=' + makeCheckoutCookie(user.id, token) +
    '; Max-Age=' + MAX_AGE + '; Path=/api/lava; Secure; HttpOnly; SameSite=Lax');
  return res.status(200).json({ok:true});
}
