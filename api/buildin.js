import { injectBuildinBridge, normalizeBuildinUrl } from '../buildin-proxy.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const requested = normalizeBuildinUrl(req.query?.url);
  if (!requested) return json(res, 400, { ok: false, error: 'invalid_buildin_url' });

  try {
    const upstream = await fetch(requested, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const finalUrl = normalizeBuildinUrl(upstream.url || requested);
    if (!finalUrl) return json(res, 502, { ok: false, error: 'invalid_buildin_redirect' });

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      return json(res, 415, { ok: false, error: 'buildin_page_not_html' });
    }

    const html = injectBuildinBridge(await upstream.text(), finalUrl);
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(html);
  } catch (error) {
    console.error('buildin_proxy_error', error?.message || error);
    return json(res, 502, { ok: false, error: 'buildin_unavailable' });
  }
}
