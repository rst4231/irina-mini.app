import { DEFAULT_RUNTIME_CONFIG, mergeRuntimeConfig } from '../runtime-config.js';

export const RUNTIME_CONFIG_URL = process.env.RUNTIME_CONFIG_URL
  || 'https://raw.githubusercontent.com/rst4231/irina-mini.app/main/runtime-config.json';

export async function loadRuntimeConfig(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(RUNTIME_CONFIG_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response?.ok) return mergeRuntimeConfig();
    const payload = await response.json();
    return mergeRuntimeConfig(payload);
  } catch {
    return mergeRuntimeConfig();
  }
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const config = await loadRuntimeConfig();
  return json(res, 200, { ok: true, config });
}

export { DEFAULT_RUNTIME_CONFIG };
