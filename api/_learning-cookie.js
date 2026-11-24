import crypto from 'node:crypto';

export const LEARNING_COOKIE = '__Host-irina-learning';
const TTL = 6 * 60 * 60;
const DOMAIN = 'irina-learning-session:v1:';

function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(DOMAIN + value).digest();
}

export function createLearningCookie(userId, secret, now = Math.floor(Date.now()/1000)) {
  const id=String(userId || '');
  if(!/^[0-9]{1,20}$/.test(id) || !secret) throw new Error('invalid_session_issuer');
  const payload=Buffer.from(JSON.stringify({id,exp:now+TTL})).toString('base64url');
  const signature=hmac(payload,secret).toString('base64url');
  return `${LEARNING_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${TTL}; HttpOnly; Secure; SameSite=Lax`;
}

export function getLearningCookieValue(cookies) {
  const pairs=String(cookies || '').split(';');
  const item=pairs.find(x=>x.trim().startsWith(LEARNING_COOKIE+'='));
  return item?.trim().slice(LEARNING_COOKIE.length+1) || '';
}

export function extractLearningCookieHeader(cookies) {
  const token=getLearningCookieValue(cookies);
  return token ? `${LEARNING_COOKIE}=${token}` : '';
}

export function verifyLearningCookie(cookies, secret, now = Math.floor(Date.now()/1000)) {
  if(!secret) return null;
  const token=getLearningCookieValue(cookies);
  const parts=token.split('.');
  if(parts.length!==2 || parts[0].length>200 || !parts[1])return null;
  try {
    const expected=hmac(parts[0],secret);
    const actual=Buffer.from(parts[1],'base64url');
    if(expected.length!==actual.length || !crypto.timingSafeEqual(expected,actual))return null;
    const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(!/^[0-9]{1,20}$/.test(payload?.id)||!Number.isSafeInteger(payload?.exp)||payload.exp<=now||payload.exp>now+TTL)return null;
    return {id:payload.id};
  } catch {return null;}
}
