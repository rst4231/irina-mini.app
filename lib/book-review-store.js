const WORKER_TIMEOUT_MS = 6500;

export async function reviewStore(path, body = {}) {
  const base = process.env.BOOK_REVIEWS_D1_URL;
  const token = process.env.BOOK_REVIEWS_D1_TOKEN;
  if (!base || !token) throw new Error('book_reviews_store_not_configured');
  let response;
  try {
    response = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
  } catch {
    throw new Error('book_reviews_store_unavailable');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    const error = new Error(result?.error || 'book_reviews_store_failed');
    error.status = response.status;
    throw error;
  }
  return result;
}
