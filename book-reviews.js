(() => {
  const root = document.getElementById('book-reviews');
  if (!root) return;
  const form = document.getElementById('book-review-form');
  const nameField = document.getElementById('review-name-field');
  const nameInput = document.getElementById('review-name');
  const textInput = document.getElementById('review-text');
  const message = document.getElementById('reviews-message');
  const submit = document.getElementById('review-submit');
  const list = document.getElementById('reviews-list');
  const more = document.getElementById('reviews-more');
  const admin = document.getElementById('reviews-admin');
  const adminList = document.getElementById('reviews-admin-list');
  const tabs = [...root.querySelectorAll('[data-review-tab]')];
  const stars = [...root.querySelectorAll('[data-review-rating]')];
  const telegram = window.Telegram?.WebApp;
  // Display-only identification. The backend verifies the signed launch data.
  const telegramUser = telegram?.initData && telegram?.initDataUnsafe?.user;
  const isTelegram = Boolean(telegramUser?.id && telegram?.initData);
  let book = 'profit';
  let rating = 0;
  let reviews = [];
  let allStats = [];
  let nextOffset = null;
  let busy = false;
  if (isTelegram) {
    nameField.hidden = true;
    nameInput.required = false;
  }
  const btnBook = new URLSearchParams(location.search).get('book');
  if (btnBook === 'beginner') book = 'beginner';

  function notice(value, failed = false) {
    message.textContent = value;
    message.style.background = failed ? '#fff0f0' : '';
    message.style.color = failed ? '#b12f44' : '';
    message.hidden = !value;
  }
  function updateStars() {
    for (const star of stars) {
      const n = Number(star.dataset.reviewRating);
      star.classList.toggle('is-selected', n <= rating);
      star.setAttribute('aria-checked', String(n === rating));
    }
  }
  for (const star of stars) {
    star.addEventListener('click', () => {
      rating = Number(star.dataset.reviewRating);
      updateStars();
      notice('');
    });
    star.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const index = Number(star.dataset.reviewRating);
      rating = Math.max(1, Math.min(5, index + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1)));
      updateStars();
      stars[rating - 1].focus();
    });
  }
  function create(tag, cls, content) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function formatDate(iso) {
    const parsed = Date.parse(iso?.includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
    return Number.isFinite(parsed)
      ? new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', year:'numeric' }).format(parsed)
      : '';
  }
  function avatar(author) {
    const circle = create('div', 'review-avatar');
    const initial = [...(String(author.author_name || '').trim())][0]?.toLocaleUpperCase('ru-RU') || 'А';
    circle.textContent = initial;
    if (author.avatar_url && /^https:\/\//i.test(author.avatar_url)) {
      const photo = document.createElement('img');
      photo.src = author.avatar_url;
      photo.alt = '';
      photo.loading = 'lazy';
      photo.referrerPolicy = 'no-referrer';
      photo.addEventListener('load', () => {
        circle.replaceChildren(photo);
      }, {once:true});
    }
    return circle;
  }
  function item(review, moderation = false) {
    const card = create('article', 'review-item');
    const head = create('div', 'review-person');
    head.append(avatar(review));
    const info = create('div', 'review-person-info');
    info.append(create('strong', '', review.author_name));
    const meta = create('div', 'review-meta');
    meta.append(create('span', 'stars', '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)));
    const date = formatDate(review.created_at);
    if (date) meta.append(document.createTextNode(' · ' + date));
    info.append(meta);
    head.append(info);
    card.append(head);
    const txt = create('p', 'review-text is-collapsed', review.review_text);
    card.append(txt);
    const expand = create('button', 'review-more', 'Читать полностью');
    expand.type = 'button';
    card.append(expand);
    requestAnimationFrame(() => {
      if (txt.scrollHeight <= txt.clientHeight + 3) {
        expand.hidden = true;
      }
    });
    expand.addEventListener('click', () => {
      const collapsed = txt.classList.toggle('is-collapsed');
      expand.textContent = collapsed ? 'Читать полностью' : 'Свернуть';
    });
    if (moderation) {
      const actions = create('div', 'review-actions');
      const approve = create('button', '', 'Одобрить');
      const reject = create('button', '', 'Отклонить');
      approve.type = reject.type = 'button';
      approve.addEventListener('click', () => moderate(review.id, 'approve'));
      reject.addEventListener('click', () => moderate(review.id, 'reject'));
      actions.append(approve, reject);
      card.append(actions);
    }
    return card;
  }
  function renderList() {
    list.replaceChildren();
    const selected = reviews.filter(v => v.book_key === book);
    if (!selected.length) {
      list.append(create('p', 'reviews-empty', 'Пока нет отзывов об этой книге. Вы можете оставить первый.'));
    } else selected.forEach(review => list.append(item(review)));
    more.hidden = nextOffset === null;
  }
  function renderRatings() {
    for (const key of ['profit','beginner']) {
      const badge = document.querySelector('[data-rating-badge="' + key + '"]');
      if (!badge) continue;
      const stats = allStats.find(v => v.book_key === key);
      const count = Number(stats?.count || 0);
      badge.hidden = count < 1;
      if (count > 0) {
        badge.querySelector('[data-rating-average]').textContent = Number(stats.average).toFixed(1).replace('.', ',');
        badge.querySelector('[data-rating-count]').textContent = '(' + count + ')';
        badge.setAttribute('aria-label', 'Средняя оценка ' + Number(stats.average).toFixed(1) + ' из 5 по ' + count + ' оценкам');
      }
    }
  }
  function selectBook(value) {
    book = value;
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.reviewTab === value)));
    notice('');
    renderList();
  }
  tabs.forEach(tab => tab.addEventListener('click', () => selectBook(tab.dataset.reviewTab)));
  async function loadReviews(append = false) {
    const offset = append ? nextOffset : 0;
    if (offset === null) return;
    const response = await fetch('/api/book-reviews?offset=' + offset, {cache:'no-store'});
    const data = await response.json();
    if (!data.ok) throw new Error('reviews_unavailable');
    reviews = append ? [...reviews, ...(data.reviews || [])] : (data.reviews || []);
    allStats = data.stats || [];
    nextOffset = data.nextOffset == null ? null : Number(data.nextOffset);
    renderRatings();
    renderList();
  }
  more.addEventListener('click', async () => {
    more.disabled = true;
    try { await loadReviews(true); } catch { notice('Не удалось загрузить отзывы.', true); }
    finally { more.disabled = false; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!rating) return notice('Выберите оценку от 1 до 5 звёзд.', true);
    if (!form.reportValidity()) return;
    busy = true;
    submit.disabled = true;
    notice('');
    try {
      const response = await fetch('/api/book-reviews', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          bookKey:book, rating, text:textInput.value, name:isTelegram?'':nameInput.value,
          initData:isTelegram ? telegram.initData : '',
          website:document.getElementById('review-website').value,
        }),
        cache:'no-store',
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Не удалось отправить отзыв.');
      textInput.value = '';
      rating = 0;
      updateStars();
      notice(result.status === 'pending'
        ? 'Ваш отзыв отправлен на модерацию.'
        : 'Спасибо! Отзыв опубликован.');
      if (result.status === 'published') await loadReviews();
    } catch (error) {
      notice(error?.message || 'Не удалось отправить отзыв.', true);
    } finally {
      busy = false;
      submit.disabled = false;
    }
  });
  async function loadAdmin() {
    if (!isTelegram || String(telegramUser.id) !== '160628165') return;
    try {
      const response = await fetch('/api/book-reviews-admin', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'list',initData:telegram.initData}),
        cache:'no-store',
      });
      const result = await response.json();
      if (!result.ok) return;
      admin.hidden = false;
      adminList.replaceChildren();
      if (!result.reviews.length) {
        adminList.append(create('p','reviews-empty','Нет отзывов на модерации.'));
      } else {
        for (const review of result.reviews) {
          const itemWrapper = create('div','reviews-admin-item');
          itemWrapper.append(create('strong','', review.book_key === 'profit' ? 'Как лить в плюс' : 'От А до Я'));
          itemWrapper.append(item(review,true));
          adminList.append(itemWrapper);
        }
      }
    } catch {}
  }
  async function moderate(id, action) {
    if (!isTelegram || String(telegramUser.id) !== '160628165') return;
    try {
      const response=await fetch('/api/book-reviews-admin',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({initData:telegram.initData,id,action}),cache:'no-store',
      });
      const data=await response.json();
      if (!data.ok) throw new Error('moderation_failed');
      await Promise.all([loadAdmin(), loadReviews()]);
    } catch { notice('Не удалось изменить статус отзыва.',true); }
  }
  selectBook(book);
  loadReviews().catch(() => {
    list.replaceChildren(create('p','reviews-empty','Отзывы временно недоступны. Попробуйте позже.'));
  });
  loadAdmin();
})();