(() => {
  // Product links always remain ordinary external anchors for browsers.
  // In Telegram Mini Apps, the official openLink API opens an external
  // browser/new tab without navigating away from the Mini App.
  const home = document.getElementById('book-back-link');
  if (home) {
    const telegram = window.Telegram?.WebApp;
    const directMiniApp = Boolean(telegram?.initData);
    let savedHome = '';
    try {
      const data = JSON.parse(sessionStorage.getItem('irina_book_home_context') || 'null');
      if (data && typeof data.savedAt === 'number' && Date.now() - data.savedAt < 86400000
          && data.savedAt <= Date.now() + 60000 && typeof data.url === 'string') {
        const url = new URL(data.url);
        if (url.origin === window.location.origin && url.pathname === '/') {
          savedHome = url.href;
        }
      }
    } catch { /* No saved Telegram entry point. */ }
    // When opened directly as a Telegram Mini App, preserve launch parameters.
    const telegramHash = directMiniApp && window.location.hash.includes('tgWebAppData=')
      ? window.location.hash : '';
    if (directMiniApp || savedHome) {
      home.href = savedHome || '/' + telegramHash;
    }
  }

  home?.addEventListener('click', event => {
    let internalReferrer = false;
    try { internalReferrer = new URL(document.referrer).origin === window.location.origin; } catch {}
    if (internalReferrer && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  });

  document.querySelectorAll('a[data-external-purchase]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const url = link.href;
      let target;
      try {
        target = new URL(url);
      } catch {
        return;
      }
      if (target.protocol !== 'https:' || target.hostname !== 'app.lava.top') return;
      const telegram = window.Telegram?.WebApp;
      if (!telegram || typeof telegram.openLink !== 'function'
        || !telegram.platform || telegram.platform === 'unknown') {
        // Standard browser: the anchor's target="_blank" opens a new tab.
        return;
      }
      event.preventDefault();
      try {
        telegram.openLink(url, { try_instant_view: false });
      } catch {
        // Fallback for older Telegram versions; still never use location.assign.
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  });
})();
