const SENDPULSE_USER_INFO_URL = 'https://api.sendpulse.com/user/info';

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

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const sendPulseApiKey = process.env.SENDPULSE_API_KEY;
  if (!botToken || !sendPulseApiKey) {
    return json(res, 503, {
      ok: false,
      telegram: Boolean(botToken),
      sendPulse: Boolean(sendPulseApiKey),
      linked: false,
    });
  }

  let telegram = false;
  let sendPulse = false;
  let botUsername = '';

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    telegram = Boolean(response.ok && payload?.ok && payload?.result);
    botUsername = telegram ? String(payload.result.username || '') : '';
  } catch (error) {
    console.error('telegram_health_error', error?.message || error);
  }

  try {
    const response = await fetch(SENDPULSE_USER_INFO_URL, {
      headers: { Authorization: `Bearer ${sendPulseApiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    sendPulse = response.ok;
  } catch (error) {
    console.error('sendpulse_health_error', error?.message || error);
  }

  const linked = telegram && sendPulse;
  return json(res, linked ? 200 : 503, {
    ok: linked,
    telegram,
    sendPulse,
    linked,
    ...(botUsername ? { botUsername } : {}),
  });
}
