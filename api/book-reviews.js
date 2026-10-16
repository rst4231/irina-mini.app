import crypto from 'node:crypto';
import { validateInitData } from './profile.js';
import { reviewStore } from '../lib/book-review-store.js';

const BOOKS = new Set(['profit', 'beginner']);
const NEGATIVE_MARKERS = /(ужас|плох|отврат|обман|мошенн|бесполез|разочар|не совет|не рекоменд|не помог|не понрав|не стоит|зря куп|зря потрат|зря заплат|ерунд|мусор|развод|обидн|низк.*качеств|ничего нового|нет пользы|не получил|не пришл|не прислал|не присыл|возврат|верните деньг|деньги назад|нет результата|не работает|обещания не|не оправдал|terrible|scam|bad|useless|disappoint|refund)/iu;

export function needsBookReviewModeration(rating, text) {
  return rating <= 3 || NEGATIVE_MARKERS.test(text) || /https?:\/\/|www\./i.test(text);
}
export function safeTelegramPhoto(value) {
  if (!value || typeof value !== 'string' || value.length > 900) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' ? url.toString() : null;
  } catch { return null; }
}
function json(res, code, value) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(code).json(value);
}
function getUser(initData, token) {
  if (!initData) return null;
  if (typeof initData !== 'string' || initData.length > 3500) return false;
  return validateInitData(initData, token);
}
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (req.method === 'GET') {
    const offset = Number(req.query?.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
      return json(res, 400, { ok: false, error: 'invalid_offset' });
    try {
      const result = await reviewStore('/list', { offset });
      return json(res, 200, { ok:true, reviews:result.reviews, stats:result.stats, nextOffset:result.nextOffset });
    } catch {
      return json(res, 503, { ok:false, error:'reviews_unavailable' });
    }
  }
  if (req.headers.origin && req.headers.origin !== 'https://irina-miniapp.vercel.app')
    return json(res, 403, { ok:false, error:'invalid_origin' });
  if (Number(req.headers['content-length'] || 0) > 8000)
    return json(res, 413, { ok:false, error:'too_large' });
  const body = req.body || {};
  if (body.website) return json(res, 400, { ok:false, error:'invalid_submission' });
  const bookKey = String(body.bookKey || '');
  const rating = Number(body.rating);
  const text = String(body.text || '').trim().replace(/\r\n?/g, '\n');
  if (!BOOKS.has(bookKey) || !Number.isInteger(rating) || rating < 1 || rating > 5
    || text.length < 10 || text.length > 2000)
    return json(res, 400, { ok:false, error:'invalid_review', message:'Выберите книгу, оценку и напишите отзыв от 10 до 2000 символов.' });
  const initData = body.initData;
  const user = getUser(initData, process.env.TELEGRAM_BOT_TOKEN);
  if (initData && !user?.id)
    return json(res, 401, { ok:false, error:'telegram_session_expired', message:'Обновите страницу в Telegram и отправьте отзыв ещё раз.' });
  const telegram = Boolean(user?.id);
  const name = telegram
    ? [user.first_name, user.last_name].map(v => String(v || '').trim()).filter(Boolean).join(' ').slice(0,60)
    : String(body.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60)
    return json(res, 400, { ok:false, error:'invalid_name', message:'Укажите имя от 2 до 60 символов.' });
  const photo = telegram ? safeTelegramPhoto(user.photo_url) : null;
  const clientIP = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim().slice(0,80);
  const identifier = telegram ? 'tg:' + user.id : 'guest:' + clientIP + ':' + String(req.headers['user-agent']||'').slice(0,180);
  const secret = process.env.BOOK_REVIEWS_D1_TOKEN;
  if (!secret) return json(res, 503, { ok:false, error:'service_not_configured' });
  const authorKey = crypto.createHmac('sha256', secret).update(identifier).digest('hex');
  const pending = needsBookReviewModeration(rating, text);
  try {
    const result = await reviewStore('/create', { review: {
      id:crypto.randomUUID(), book_key:bookKey, rating, review_text:text, author_name:name,
      avatar_url:photo, telegram_user_id:telegram ? String(user.id) : null,
      submitter_key:authorKey, status:pending?'pending':'published',
      moderation_reason:pending?'negative_or_mixed':'',
    } });
    return json(res, 201, { ok:true, status:result.status });
  } catch (error) {
    if (error.status === 429)
      return json(res, 429, {ok:false,error:'rate_limited',message:'Вы уже оставляли отзывы недавно. Попробуйте завтра.'});
    return json(res, 503, {ok:false,error:'reviews_unavailable',message:'Не удалось сохранить отзыв. Попробуйте чуть позже.'});
  }
}
