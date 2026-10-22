// First-visit badges on the main menu. Cloudflare D1 is authoritative; local storage keeps UI responsive offline.
(() => {
  const sectionKeys = new Set(['recruitment', 'about', 'theory', 'practice', 'book', 'store', 'mentor']);
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const telegramId = tg?.initDataUnsafe?.user?.id;
  const storageKey = 'irina.home-sections.v1.' + (Number.isSafeInteger(telegramId) && telegramId > 0 ? telegramId : 'browser');
  const cards = new Map([...document.querySelectorAll('.resource-button[data-resource-key]')]
    .filter(card => sectionKeys.has(card.dataset.resourceKey))
    .map(card => [card.dataset.resourceKey, card]));
  function readCached() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      return new Set(Array.isArray(raw) ? raw.filter(key => sectionKeys.has(key)) : []);
    } catch { return new Set(); }
  }
  const seen = readCached();
  function cacheSeen() {
    try { window.localStorage.setItem(storageKey, JSON.stringify([...seen])); } catch {}
  }
  for (const card of cards.values()) {
    const title = card.querySelector('.resource-title');
    if (!title) continue;
    const heading = document.createElement('span');
    heading.className = 'resource-heading';
    const badge = document.createElement('span');
    badge.className = 'resource-new';
    badge.textContent = 'NEW';
    badge.setAttribute('aria-label', 'New');
    badge.setAttribute('aria-hidden', 'true');
    title.before(heading);
    heading.append(title, badge);
  }
  function render() {
    for (const [key, card] of cards) {
      const badge = card.querySelector('.resource-new');
      if (badge) badge.hidden = seen.has(key);
    }
  }
  async function remote(action, section) {
    if (!initData) return null;
    try {
      const response = await fetch('/api/home-sections', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({initData, action, ...(section ? {section} : {})}),
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
  }
  function mark(key) {
    if (!sectionKeys.has(key) || seen.has(key)) return;
    seen.add(key);
    cacheSeen();
    render();
    void remote('mark', key);
  }
  // Capture before in-app iframe viewers stop propagation for their own navigation.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest('.resource-button[data-resource-key]');
    if (!card || card.hidden || card.closest('[hidden]') || !cards.has(card.dataset.resourceKey)) return;
    mark(card.dataset.resourceKey);
  }, true);
  async function synchronize() {
    const answer = await remote('list');
    if (!Array.isArray(answer?.seen)) return;
    const remoteSeen = new Set(answer.seen.filter(key => sectionKeys.has(key)));
    const locallySeen = [...seen];
    for (const key of remoteSeen) seen.add(key);
    cacheSeen();
    render();
    // Restore clicks made while Cloudflare was unavailable.
    await Promise.allSettled(locallySeen.filter(key => !remoteSeen.has(key)).map(key => remote('mark', key)));
  }
  render();
  void synchronize();
  window.addEventListener('pageshow', () => { render(); void synchronize(); });
})();
