// Keep Telegram's signed launch data during same-origin navigation.
// Access is granted only after the backend verifies the signature and SendPulse tag.
export const SESSION_KEY = 'irina.telegram-init-data.v1';
export const MAX_AGE_SECONDS = 6 * 60 * 60;

export function validLaunchData(value, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 3500) return false;
  const fields = new URLSearchParams(value);
  const authDate = Number(fields.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) return false;
  if (!/^[a-f0-9]{64}$/i.test(fields.get('hash') || '')) return false;
  const age = nowSeconds - authDate;
  return age >= -60 && age < MAX_AGE_SECONDS;
}

export function resolveLaunchData(current, storage, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (validLaunchData(current, nowSeconds)) {
    try { storage?.setItem(SESSION_KEY, current); } catch { /* Storage unavailable */ }
    return current;
  }
  try {
    const saved = storage?.getItem(SESSION_KEY) || '';
    if (validLaunchData(saved, nowSeconds)) return saved;
    storage?.removeItem(SESSION_KEY);
  } catch { /* Storage unavailable */ }
  return '';
}
