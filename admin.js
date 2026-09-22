const telegram = window.Telegram?.WebApp;
const ADMIN_TELEGRAM_ID = '160628165';

const loading = document.getElementById('admin-loading');
const denied = document.getElementById('admin-denied');
const form = document.getElementById('admin-form');
const sections = document.getElementById('admin-sections');
const message = document.getElementById('admin-message');
const saveButton = document.getElementById('save-button');
const versionLabel = document.getElementById('config-version');
const releaseLabel = document.getElementById('admin-release');

let config = null;

const FIELD_GROUPS = [
  {
    title: 'Оформление',
    fields: [
      ['ui.accent', 'Основной цвет', 'color'],
      ['ui.accentSecondary', 'Второй цвет', 'color'],
      ['ui.showFreshness', 'Показывать актуальность данных', 'boolean'],
      ['ui.animations', 'Плавные анимации статусов', 'boolean'],
      ['telegram.requestFullscreen', 'Полноэкранный режим Telegram', 'boolean'],
    ],
  },
  {
    title: 'Видимость блоков',
    fields: [
      ['features.recruitment', 'Набор', 'boolean'],
      ['features.about', 'О команде', 'boolean'],
      ['features.book', 'Книга', 'boolean'],
      ['features.trustedBy', 'Нам доверяют', 'boolean'],
      ['features.channel', 'Telegram-канал', 'boolean'],
      ['features.mentor', 'Наставник', 'boolean'],
    ],
  },
];

const CONTENT_GROUPS = [
  ['Набор', [
    ['copy.recruitmentBadge', 'Бейдж'],
    ['copy.recruitmentTitle', 'Заголовок'],
    ['copy.recruitmentSubtitle', 'Подзаголовок', 'textarea'],
    ['links.recruitment', 'Ссылка', 'url'],
  ]],
  ['О команде', [
    ['copy.aboutTitle', 'Заголовок'],
    ['copy.aboutSubtitle', 'Подзаголовок', 'textarea'],
    ['links.about', 'Ссылка', 'url'],
  ]],
  ['Книга', [
    ['copy.bookTitle', 'Заголовок'],
    ['copy.bookSubtitle', 'Подзаголовок', 'textarea'],
    ['links.book', 'Ссылка', 'url'],
  ]],
  ['Наставник', [
    ['copy.mentorTitle', 'Заголовок'],
    ['copy.mentorSubtitle', 'Подзаголовок', 'textarea'],
    ['links.mentor', 'Ссылка', 'url'],
  ]],
  ['Нам доверяют', [['copy.trustedByTitle', 'Заголовок']]],
  ['Telegram-канал', [['links.channel', 'Ссылка', 'url']]],
];

const APPLICATION_GROUPS = [
  ['Не заполнена', 'incomplete', 'links.fillApplication'],
  ['Заполнена', 'complete', null],
  ['Одобрена', 'approved', 'links.discussTerms'],
  ['Условия готовы', 'terms', 'links.viewTerms'],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function setPath(target, path, value) {
  const keys = path.split('.');
  let current = target;
  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  });
  current[keys.at(-1)] = value;
}

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function createField(path, label, type = 'text', options = {}) {
  if (type === 'boolean') {
    const wrap = create('label', 'toggle');
    const input = create('input');
    input.type = 'checkbox';
    input.dataset.path = path;
    input.checked = Boolean(getPath(config, path));
    const caption = create('span', '', label);
    wrap.append(input, caption);
    return wrap;
  }

  const wrap = create('label', 'field');
  wrap.append(create('span', '', label));
  const input = type === 'textarea' ? create('textarea') : create('input');
  if (type !== 'textarea') input.type = type === 'seconds' ? 'number' : type;
  if (type === 'textarea') input.rows = options.rows || 2;
  input.dataset.path = path;
  if (type === 'seconds') {
    input.dataset.scale = '1000';
    input.min = '15';
    input.max = '3600';
    input.value = String(Math.round(Number(getPath(config, path) || 0) / 1000));
  } else {
    input.value = String(getPath(config, path) ?? '');
  }
  wrap.append(input);
  return wrap;
}

function createCard(title) {
  const card = create('section', 'admin-card');
  card.append(create('h2', '', title));
  return card;
}

function renderSimpleGroups() {
  for (const group of FIELD_GROUPS) {
    const card = createCard(group.title);
    const body = create('div', group.fields.every((item) => item[2] === 'boolean') ? 'toggle-list two-columns' : 'fields');
    for (const field of group.fields) body.append(createField(...field));
    card.append(body);
    sections.append(card);
  }
}

function renderOrder() {
  const labels = {
    recruitment: 'Набор',
    about: 'О команде',
    book: 'Книга',
    trustedBy: 'Нам доверяют',
    mentor: 'Наставник',
  };
  const card = createCard('Порядок блоков');
  card.append(create('p', 'admin-help', 'Стрелками меняй порядок. Скрытые блоки сохраняют своё место.'));
  const list = create('div', 'order-list');
  list.id = 'resource-order';

  function draw() {
    list.replaceChildren();
    config.ui.resourceOrder.forEach((key, index) => {
      const row = create('div', 'order-row');
      row.append(create('span', 'order-name', labels[key] || key));
      const actions = create('span', 'order-actions');
      const up = create('button', 'order-button', '↑');
      const down = create('button', 'order-button', '↓');
      up.type = down.type = 'button';
      up.disabled = index === 0;
      down.disabled = index === config.ui.resourceOrder.length - 1;
      up.addEventListener('click', () => {
        [config.ui.resourceOrder[index - 1], config.ui.resourceOrder[index]] = [key, config.ui.resourceOrder[index - 1]];
        draw();
      });
      down.addEventListener('click', () => {
        [config.ui.resourceOrder[index + 1], config.ui.resourceOrder[index]] = [key, config.ui.resourceOrder[index + 1]];
        draw();
      });
      actions.append(up, down);
      row.append(actions);
      list.append(row);
    });
  }

  draw();
  card.append(list);
  sections.append(card);
}

function renderContent() {
  const card = createCard('Основные блоки');
  CONTENT_GROUPS.forEach(([title, fields], index) => {
    const details = create('details', 'admin-details');
    details.open = index === 0;
    details.append(create('summary', '', title));
    const body = create('div', 'fields');
    fields.forEach((field) => body.append(createField(...field)));
    details.append(body);
    card.append(details);
  });
  sections.append(card);
}

function renderApplication() {
  const card = createCard('Анкета');
  APPLICATION_GROUPS.forEach(([title, state, linkPath], index) => {
    const details = create('details', 'admin-details');
    details.open = index === 0;
    details.append(create('summary', '', title));
    const body = create('div', 'fields');
    body.append(createField(`copy.application.${state}.status`, 'Статус'));
    body.append(createField(`copy.application.${state}.description`, 'Описание', 'textarea'));
    if (getPath(config, `copy.application.${state}.button`) != null) {
      body.append(createField(`copy.application.${state}.button`, 'Кнопка'));
    }
    if (getPath(config, `copy.application.${state}.hint`) != null) {
      body.append(createField(`copy.application.${state}.hint`, 'Подсказка'));
    }
    if (linkPath) body.append(createField(linkPath, 'Ссылка кнопки', 'url'));
    details.append(body);
    card.append(details);
  });
  sections.append(card);
}

function renderSystem() {
  const card = createCard('Системные тексты');
  const body = create('div', 'fields');
  [
    ['copy.syncError', 'Ошибка обновления'],
    ['copy.retry', 'Кнопка повтора'],
    ['copy.checkingChanges', 'Проверка изменений'],
    ['copy.staleData', 'Устаревшие данные'],
    ['copy.updatedNow', 'Обновлено сейчас'],
    ['copy.updatedMinutes', 'Обновлено N минут назад'],
    ['copy.cachedAt', 'Данные от времени'],
  ].forEach((field) => body.append(createField(...field)));
  card.append(body);
  sections.append(card);

  const outside = createCard('Экран вне Telegram');
  const outsideBody = create('div', 'fields');
  [
    ['copy.outsideTitle', 'Заголовок'],
    ['copy.outsideDescription', 'Описание', 'textarea'],
    ['copy.outsideButton', 'Кнопка'],
    ['links.outsideBot', 'Ссылка на бота', 'url'],
  ].forEach((field) => outsideBody.append(createField(...field)));
  outside.append(outsideBody);
  sections.append(outside);
}

function renderPolling() {
  const card = createCard('Частота обновления');
  card.append(create('p', 'admin-help', 'Указывается в секундах. Минимум — 15 секунд.'));
  const body = create('div', 'admin-grid two');
  [
    ['polling.pendingMs', 'После заполнения анкеты', 'seconds'],
    ['polling.approvedMs', 'После одобрения', 'seconds'],
    ['polling.idleMs', 'Обычный режим', 'seconds'],
    ['polling.finalMs', 'Финальный статус', 'seconds'],
    ['polling.configMs', 'Обновление настроек', 'seconds'],
  ].forEach((field) => body.append(createField(...field)));
  card.append(body);
  sections.append(card);
}

function render() {
  sections.replaceChildren();
  versionLabel.textContent = String(config.version || 1);
  renderSimpleGroups();
  renderOrder();
  renderContent();
  renderApplication();
  renderSystem();
  renderPolling();
}

function collectConfig() {
  const next = clone(config);
  document.querySelectorAll('[data-path]').forEach((input) => {
    let value;
    if (input.type === 'checkbox') value = input.checked;
    else if (input.type === 'number') value = Number(input.value || 0) * Number(input.dataset.scale || 1);
    else value = input.value.trim();
    setPath(next, input.dataset.path, value);
  });
  return next;
}

function showMessage(text, tone = 'ok') {
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = false;
}

function syncTheme() {
  const theme = telegram?.colorScheme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
}

async function loadRelease() {
  try {
    const response = await fetch(`/api/version?_fresh=${Date.now()}`, { cache: 'no-store' });
    const payload = await response.json();
    if (payload?.release) releaseLabel.textContent = payload.release;
  } catch {}
}

async function loadConfig() {
  const response = await fetch('/api/admin-config', {
    headers: {
      Accept: 'application/json',
      'X-Telegram-Init-Data': telegram.initData,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.config) throw new Error(payload?.error || 'load_failed');
  config = payload.config;
  render();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveButton.disabled = true;
  saveButton.textContent = 'Сохраняем…';
  message.hidden = true;

  try {
    const response = await fetch('/api/admin-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegram.initData, config: collectConfig() }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.config) throw new Error(payload?.error || 'save_failed');
    config = payload.config;
    render();
    showMessage(`Сохранено. Версия конфига: ${config.version}`);
    try { telegram?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
  } catch {
    showMessage('Не удалось сохранить настройки. Попробуйте ещё раз.', 'error');
    try { telegram?.HapticFeedback?.notificationOccurred?.('error'); } catch {}
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Сохранить изменения';
  }
});

async function start() {
  syncTheme();
  telegram?.onEvent?.('themeChanged', syncTheme);

  const userId = String(telegram?.initDataUnsafe?.user?.id || '');
  if (!telegram?.initData || userId !== ADMIN_TELEGRAM_ID) {
    loading.hidden = true;
    denied.hidden = false;
    return;
  }

  try {
    telegram.ready();
    telegram.expand();
  } catch {}

  loadRelease();
  try {
    await loadConfig();
    loading.hidden = true;
    form.hidden = false;
  } catch {
    loading.hidden = true;
    denied.hidden = false;
    denied.querySelector('p').textContent = 'Не удалось подтвердить доступ или загрузить настройки.';
  }
}

start();
