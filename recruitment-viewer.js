// The recruitment page is opened inside the Telegram Mini App without the Buildin viewer UI.
(function () {
  const HOST = 'team.arbstart.tech';
  const buttonId = 'join-team-button';
  let viewer = null;
  let frame = null;
  let previousOverflow = '';
  let historyArmed = false;

  function allowedUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'https:' && url.hostname === HOST ? url.href : null;
    } catch {
      return null;
    }
  }

  function ensureViewer() {
    if (viewer?.isConnected) return;

    const style = document.createElement('style');
    style.textContent = `
      .recruitment-embedded {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        width: 100% !important;
        height: 100vh !important;
        height: 100dvh !important;
        background: #fff !important;
      }
      .recruitment-embedded[hidden] { display: none !important; }
      .recruitment-embedded__frame {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
      }
      .recruitment-embedded__close {
        position: absolute;
        z-index: 1;
        top: calc(env(safe-area-inset-top, 0px) + 10px);
        right: calc(env(safe-area-inset-right, 0px) + 10px);
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid rgba(15, 23, 42, .1);
        border-radius: 50%;
        background: rgba(255, 255, 255, .96);
        box-shadow: 0 3px 16px rgba(15, 23, 42, .16);
        color: #172339;
        font: 24px/1 system-ui, sans-serif;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    viewer = document.createElement('section');
    viewer.className = 'recruitment-embedded';
    viewer.hidden = true;
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-label', 'Набор');

    frame = document.createElement('iframe');
    frame.className = 'recruitment-embedded__frame';
    frame.title = 'Набор';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('allow', 'clipboard-read; clipboard-write');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'recruitment-embedded__close';
    close.setAttribute('aria-label', 'Закрыть');
    close.textContent = '×';
    close.addEventListener('click', () => {
      closeViewer();
      if (historyArmed) {
        historyArmed = false;
        window.history.back();
      }
    });

    viewer.append(frame, close);
    document.body.appendChild(viewer);
  }

  function closeViewer() {
    if (!viewer || viewer.hidden) return;
    viewer.hidden = true;
    frame.src = 'about:blank';
    document.body.style.overflow = previousOverflow;
  }

  function openViewer(url) {
    ensureViewer();
    if (viewer.hidden) {
      previousOverflow = document.body.style.overflow;
      try {
        const state = window.history.state;
        const next = state && typeof state === 'object' ? { ...state } : {};
        next.__recruitmentViewer = true;
        window.history.pushState(next, '', window.location.href);
        historyArmed = true;
      } catch {
        historyArmed = false;
      }
    }
    frame.src = url;
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor || anchor.id !== buttonId || anchor.hidden || anchor.closest('[hidden]')) return;
    const url = allowedUrl(anchor.href);
    if (!url) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openViewer(url);
  }, true);

  window.addEventListener('popstate', () => {
    if (!historyArmed || !viewer || viewer.hidden) return;
    historyArmed = false;
    closeViewer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !viewer || viewer.hidden) return;
    event.preventDefault();
    closeViewer();
    if (historyArmed) {
      historyArmed = false;
      window.history.back();
    }
  });
})();
