(() => {
  const device = window.matchMedia('(prefers-color-scheme: dark)');
  const telegram = window.Telegram?.WebApp;
  function apply() {
    const dark = telegram?.initData && ['dark', 'light'].includes(telegram.colorScheme)
      ? telegram.colorScheme === 'dark' : device.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c1424' : '#f1f6ff');
  }
  apply();
  device.addEventListener?.('change', apply);
  telegram?.onEvent?.('themeChanged', apply);
})();
