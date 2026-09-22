import { DEFAULT_RUNTIME_CONFIG, mergeRuntimeConfig } from '../runtime-config.js';
import { loadStoredRuntimeConfig } from '../sendpulse-config.js';

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
  let baseConfig = mergeRuntimeConfig();

  try {
    const response = await fetchImpl(getFreshRuntimeConfigUrl(), {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });
    if (response?.ok) {
      const payload = await response.json();
      baseConfig = mergeRuntimeConfig(payload);
    }
  } catch {}

  const sendPulseApiKey = process.env.SENDPULSE_API_KEY;
  if (!sendPulseApiKey) return baseConfig;

  try {
    const storedConfig = await loadStoredRuntimeConfig(sendPulseApiKey);
    return storedConfig ? mergeRuntimeConfig(storedConfig) : baseConfig;
  } catch (error) {
    console.error('runtime_config_storage_error', error?.message || error);
    return baseConfig;
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
