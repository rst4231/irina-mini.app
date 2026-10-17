(() => {
  const t = text => window.BookPage?.t(text) || text;
  const panels = [...document.querySelectorAll('[data-book-reviews]')];
  if (!panels.length) return;
  const telegram = window.Telegram?.WebApp;
  const telegramUser = telegram?.initData && telegram?.initDataUnsafe?.user;
  const isTelegram = Boolean(telegramUser?.id && telegram.initData);
  const isAdminCandidate = isTelegram && String(telegramUser.id) === '160628165';
  const admin = document.getElementById('reviews-admin');
  const adminList = document.getElementById('reviews-admin-list');
  const state = {reviews: [], stats: [], nextOffset: null, loading: false, loaded: false, error: false};
  const ratingValues = new Map();

  function el(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function avatar(review) {
    const circle = el('div','review-avatar');
    circle.textContent = [...String(review.author_name || '').trim()][0]?.toLocaleUpperCase('ru-RU') || 'R';
    return circle;
  }
  function item(review, forModeration = false) {
    const card = el('article','review-item');
    const header = el('div','review-person');
    header.append(avatar(review));
    const info = el('div','review-person-info');
    info.append(el('strong','',review.author_name || t('Читатель')));
    const meta = el('div','review-meta');
    const score = Number(review.rating);
    const stars = Number.isInteger(score) && score >= 1 && score <= 5
      ? '★'.repeat(score) + '☆'.repeat(5-score) : '';
    if (stars) meta.append(el('span','stars',stars));
    info.append(meta);
    header.append(info);
    card.append(header);
    const paragraph = el('p','review-text is-collapsed',review.review_text);
    card.append(paragraph);
    const toggle = el('button','review-more',t('Читать полностью'));
    toggle.type = 'button';
    toggle.hidden = true;
    card.append(toggle);
    requestAnimationFrame(() => {
      if (paragraph.scrollHeight > paragraph.clientHeight + 3) toggle.hidden = false;
    });
    toggle.addEventListener('click', () => {
      const nowCollapsed = paragraph.classList.toggle('is-collapsed');
      toggle.textContent = nowCollapsed ? t('Читать полностью') : t('Свернуть');
    });
    if (forModeration) {
      const actions = el('div','review-actions');
      const publish = el('button','',t('Опубликовать'));
      const remove = el('button','',t('Удалить'));
      publish.type = remove.type = 'button';
      publish.addEventListener('click', () => moderate(review.id,'approve'));
      remove.addEventListener('click', () => {
        if (window.confirm(t('Удалить отзыв окончательно?'))) moderate(review.id,'delete');
      });
      actions.append(publish,remove);
      card.append(actions);
    }
    return card;
  }
  function render() {
    for (const panel of panels) {
      const book = panel.dataset.bookReviews;
      const list = panel.querySelector('[data-reviews-list]');
      list.replaceChildren();
      const reviews = state.reviews.filter(r => r.book_key === book);
      if (!reviews.length) list.append(el('p','reviews-empty',t(state.error ? 'Отзывы временно недоступны.' : state.loaded ? 'Пока нет отзывов об этой книге.' : 'Загружаем отзывы…')));
      else reviews.forEach(r => list.append(item(r)));
      panel.querySelector('[data-reviews-more]').hidden = state.nextOffset == null;
      const badge = document.querySelector('[data-rating-badge="' + book + '"]');
      if (badge) {
        const agg = state.stats.find(v => v.book_key === book);
        const count = Number(agg?.count || 0);
        badge.hidden = count === 0;
        if (count) {
          badge.querySelector('[data-rating-average]').textContent = Number(agg.average).toLocaleString(window.BookPage?.language === 'en' ? 'en-US' : 'ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
          badge.querySelector('[data-rating-count]').textContent = '(' + count + ')';
          badge.setAttribute('aria-label',window.BookPage?.language === 'en' ? 'Average rating ' + Number(agg.average).toFixed(1) + ' out of 5. Ratings: ' + count : 'Средний рейтинг ' + Number(agg.average).toFixed(1) + ' из 5. Оценок: ' + count);
        }
      }
    }
  }
  async function loadReviews(more = false) {
    if (state.loading || (more && state.nextOffset == null)) return;
    state.loading = true;
    try {
      const offset = more ? state.nextOffset : 0;
      const response = await fetch('/api/book-reviews?offset=' + offset,{cache:'no-store'});
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error('reviews_unavailable');
      state.reviews = more ? [...state.reviews,...(json.reviews || [])] : (json.reviews || []);
      state.stats = json.stats || [];
      state.nextOffset = json.nextOffset == null ? null : Number(json.nextOffset);
      state.loaded = true;
      state.error = false;
      render();
    } finally {
      state.loading = false;
    }
  }
  function message(form, text, failed = false) {
    const node = form.querySelector('[data-review-message]');
    node.dataset.reviewMessage = text;
    node.textContent = t(text);
    node.hidden = !text;
    node.classList.toggle('is-error',failed);
  }
  for (const panel of panels) {
    const book = panel.dataset.bookReviews;
    const form = panel.querySelector('[data-review-form]');
    const nameField = form.querySelector('[data-review-name-field]');
    const nameInput = form.elements.name;
    if (isTelegram) { nameField.hidden = true; nameInput.required = false; }
    const buttons = [...form.querySelectorAll('[data-review-rating]')];
    ratingValues.set(book,0);
    function selectStar(value) {
      ratingValues.set(book,value);
      buttons.forEach(button => {
        const n = Number(button.dataset.reviewRating);
        button.classList.toggle('is-selected',n <= value);
        button.setAttribute('aria-checked',String(n === value));
      });
    }
    for (const button of buttons) {
      button.addEventListener('click',() => {selectStar(Number(button.dataset.reviewRating));message(form,'');});
      button.addEventListener('keydown',event => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const delta = ['ArrowLeft','ArrowDown'].includes(event.key) ? -1 : 1;
        const value = Math.max(1,Math.min(5,Number(button.dataset.reviewRating)+delta));
        selectStar(value);
        buttons[value-1].focus();
      });
    }
    panel.querySelector('[data-reviews-more]').addEventListener('click',() => {
      loadReviews(true).catch(() => message(form,'Не удалось загрузить отзывы.',true));
    });
    form.addEventListener('submit',async event => {
      event.preventDefault();
      const rating=ratingValues.get(book);
      if (!rating) return message(form,'Выберите оценку от 1 до 5 звёзд.',true);
      if (!form.reportValidity()) return;
      const submit=form.querySelector('[type="submit"]');
      submit.disabled=true;
      message(form,'');
      try {
        const response=await fetch('/api/book-reviews',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            bookKey:book,rating,text:form.elements.reviewText.value,
            name:isTelegram ? '' : nameInput.value,
            initData:isTelegram ? telegram.initData : '',
            website:form.elements.website.value,
          }),cache:'no-store',
        });
        const json=await response.json();
        if (!response.ok||!json.ok) throw new Error(json.message||'Не удалось отправить отзыв.');
        form.elements.reviewText.value='';
        selectStar(0);
        message(form,json.status==='pending'
          ? 'Ваш отзыв отправлен на модерацию.'
          : 'Спасибо! Отзыв опубликован.');
        if (json.status==='published') await loadReviews();
      } catch (error) {message(form,error.message||'Не удалось отправить отзыв.',true);}
      finally {submit.disabled=false;}
    });
  }
  async function loadAdmin() {
    if (!isAdminCandidate || !admin) return;
    try {
      const response=await fetch('/api/book-reviews-admin',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'list',initData:telegram.initData}),cache:'no-store',
      });
      const json=await response.json();
      if (!response.ok||!json.ok) return;
      admin.hidden=false;
      adminList.replaceChildren();
      if (!json.reviews?.length) adminList.append(el('p','reviews-empty',t('Нет отзывов на модерации.')));
      else json.reviews.forEach(r => {
        const row=el('div','reviews-admin-item');
        row.append(el('strong','',r.book_key==='profit'?t('Как лить в плюс'):t('От А до Я')));
        row.append(item(r,true));
        adminList.append(row);
      });
    } catch {}
  }
  async function moderate(id,action) {
    if (!isAdminCandidate) return;
    try {
      const response=await fetch('/api/book-reviews-admin',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({initData:telegram.initData,id,action}),cache:'no-store',
      });
      const json=await response.json();
      if (!response.ok||!json.ok||!json.updated) throw new Error('moderation_failed');
      await Promise.all([loadAdmin(),loadReviews()]);
    } catch {window.alert(t('Не удалось изменить статус отзыва. Попробуйте ещё раз.'));}
  }
  window.addEventListener('booklanguagechange',() => {
    render();
    document.querySelectorAll('[data-review-message]').forEach(node => {
      if (node.dataset.reviewMessage) node.textContent = t(node.dataset.reviewMessage);
    });
    if (isAdminCandidate) loadAdmin();
  });
  loadReviews().catch(() => {state.error = true; render();});
  loadAdmin();
})();
