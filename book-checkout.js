(() => {
  // Product links always remain ordinary external anchors for browsers.
  // In Telegram Mini Apps, the official openLink API opens an external
  // browser/new tab without navigating away from the Mini App.
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
