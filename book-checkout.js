(() => {
  const dialog = document.getElementById('checkout-dialog');
  const form = document.getElementById('checkout-form');
  const input = document.getElementById('checkout-email');
  const title = document.getElementById('checkout-book');
  const total = document.getElementById('checkout-total');
  const submit = document.getElementById('checkout-submit');
  const errorNode = document.getElementById('checkout-error');
  const resultNode = document.getElementById('payment-result');
  const resultText = document.getElementById('payment-result-text');
  let selected = null;
  let busy = false;
  const items = {
    profit: { title: 'Как лить в плюс', amount: '690 ₽' },
    beginner: { title: 'Арбитраж трафика от А до Я', amount: '590 ₽' }
  };

  function setError(value = '') {
    errorNode.textContent = value;
    errorNode.hidden = !value;
  }
  function close() {
    if (busy) return;
    dialog.hidden = true;
    document.body.classList.remove('checkout-open');
  }
  function open(book) {
    if (!items[book] || busy) return;
    selected = book;
    title.textContent = items[book].title;
    total.textContent = items[book].amount;
    setError();
    dialog.hidden = false;
    document.body.classList.add('checkout-open');
    const stored = sessionStorage.getItem('irina.book.email');
    if (stored && !input.value) input.value = stored;
    input.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-checkout-book]').forEach(btn => {
    btn.addEventListener('click', () => open(btn.dataset.checkoutBook));
  });
  document.querySelectorAll('[data-close-checkout]').forEach(btn => btn.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.hidden) close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !selected || !form.reportValidity()) return;
    busy = true;
    submit.disabled = true;
    submit.textContent = 'Подготавливаем оплату…';
    setError();
    const email = input.value.trim();
    try {
      const response = await fetch('/api/lava/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book: selected, email }),
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось создать счёт.');
      const url = new URL(payload.paymentUrl);
      if (url.protocol !== 'https:' || !(url.hostname === 'lava.top' || url.hostname.endsWith('.lava.top'))) throw new Error('Получена некорректная ссылка на оплату.');
      try { sessionStorage.setItem('irina.book.email', email); } catch {}
      // Navigate this SAME Telegram Mini App webview. Never open a second tab.
      window.location.assign(url.href);
    } catch (error) {
      setError(error.message || 'Не удалось подготовить оплату. Попробуйте позже.');
      busy = false;
      submit.disabled = false;
      submit.textContent = 'Перейти к оплате';
    }
  });
  const params = new URLSearchParams(window.location.search);
  const returnedInvoice = params.get('invoiceId');
  const returnStatus = params.get('status');
  if (returnedInvoice && /^[0-9a-f-]{36}$/i.test(returnedInvoice)) {
    resultNode.hidden = false;
    if (returnStatus === 'success') {
      resultText.textContent = 'Проверяем платёж в Lava.top…';
    } else if (returnStatus === 'cancelled') {
      resultText.textContent = 'Оплата отменена. Вы можете выбрать книгу и попробовать снова.';
    } else if (returnStatus === 'failed') {
      resultText.textContent = 'Оплата не прошла. Попробуйте ещё раз.';
    } else {
      resultText.textContent = 'Проверяем статус оплаты…';
    }
    fetch('/api/lava/status?invoiceId=' + encodeURIComponent(returnedInvoice), {cache:'no-store'})
      .then(r => r.json())
      .then(payload => {
        if (payload.ok && payload.paid) resultText.textContent = 'Оплата подтверждена! Книга будет доступна через Lava.top.';
        else if (returnStatus === 'success') resultText.textContent = 'Платёж обрабатывается. Проверьте письмо от Lava.top или повторите проверку позже.';
      })
      .catch(() => { if (returnStatus === 'success') resultText.textContent = 'Платёж проверяется. Проверьте письмо от Lava.top.'; });
    // Do not leave misleading status in a shared/bookmarked URL.
    history.replaceState(history.state, '', '/book');
  }
})();
