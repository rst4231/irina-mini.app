import { APP_RELEASE } from '../release.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(body));
}

export function getDeploymentVersion(env = process.env) {
  return String(
    env.VERCEL_DEPLOYMENT_ID
      || env.VERCEL_GIT_COMMIT_SHA
      || env.VERCEL_URL
      || 'local'
  );
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  return sendJson(res, 200, {
    ok: true,
    version: getDeploymentVersion(),
    release: APP_RELEASE,
  });
}
