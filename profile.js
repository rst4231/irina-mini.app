export function formatRussianDayMonth(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatProfileDate(date = new Date(), language = 'ru') {
  const locale = language === 'en' ? 'en-US' : 'ru-RU';
  const text = new Intl.DateTimeFormat(locale, {
    weekday:'long',day:'numeric',month:'long',year:'numeric',
  }).format(date);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

export function normalizeTelegramUser(user = {}) {
  const firstName = String(user.first_name || '').trim();
  const lastName = String(user.last_name || '').trim();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Пользователь';
  const usernameValue = String(user.username || '').trim().replace(/^@+/, '');
  const username = usernameValue ? `@${usernameValue}` : '';
  const photoUrl = String(user.photo_url || '').trim();
  const initial = Array.from(name)[0]?.toUpperCase() || 'П';

  return { name, username, photoUrl, initial };
}
