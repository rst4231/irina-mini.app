// Disable page zoom without interfering with one-finger scrolling or taps.
// The viewport meta prevents most zooming; iOS gestures need this extra guard.
(() => {
  const prevent = (event) => event.preventDefault();
  for (const eventName of ['gesturestart', 'gesturechange']) {
    document.addEventListener(eventName, prevent, { passive: false });
  }
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
})();
