import { DEFAULT_RUNTIME_CONFIG, mergeRuntimeConfig } from '../runtime-config.js';

export const RUNTIME_CONFIG_URL = process.env.RUNTIME_CONFIG_URL
  || 'https://raw.githubusercontent.com/rst4231/irina-mini.app/main/runtime-config.json';

function getFreshRuntimeConfigUrl() {
  try {
    const url = new URL(RUNTIME_CONFIG_URL);
    url.searchParams.set('_fresh', String(Date.now()));
    return url.toString();
  } catch {
    return RUNTIME_CONFIG_URL;
  }
}

export async function loadRuntimeConfig(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(getFreshRuntimeConfigUrl(), {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
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
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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
