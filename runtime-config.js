const DEFAULT_APPLICATION_COPY = {
  incomplete: {
    status: 'Анкета не заполнена',
    description: 'Заполните короткую анкету и обсудите условия',
    button: 'Заполнить анкету',
    hint: 'Займет пару минут',
  },
  complete: {
    status: 'Анкета заполнена',
    description: 'Анкета отправлена. Ожидайте результат проверки',
  },
  approved: {
    status: 'Анкета одобрена',
    description: 'Анкета одобрена. Обсудите условия участия',
    button: 'Обсудить условия',
    hint: 'Займет 10–15 минут',
  },
  rejected: {
    status: 'Анкета не одобрена',
    description: 'К сожалению, ваша анкета не прошла отбор',
  },
  terms: {
    status: 'Условия готовы',
    description: 'Условия готовы. Посмотрите детали участия',
    button: 'Посмотреть условия',
  },
};

export const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  version: 2,
  book: {prices: {profit: {rub:690,usd:8.28},beginner: {rub:590,usd:7.08}}},
  features: {
    recruitment: true,
    about: true,
    book: true,
    trustedBy: true,
    channel: true,
    mentor: true,
  },
  telegram: {
    requestFullscreen: false,
  },
  ui: {
    accent: '#347ef4',
    accentSecondary: '#4a91f8',
    resourceOrder: ['recruitment', 'about', 'book', 'trustedBy', 'mentor'],
    showFreshness: true,
    animations: true,
  },
  polling: {
    pendingMs: 45000,
    approvedMs: 60000,
    idleMs: 300000,
    finalMs: 900000,
    configMs: 120000,
  },
  links: {
    fillApplication: 'https://t.me/rstshelp_bot?start=69de0afdde3f2d88240a95e8',
    discussTerms: 'https://t.me/rstshelp_bot?start=6a3d21d4694618648d009d8d',
    viewTerms: 'https://team.arbstart.tech/win-win/',
    recruitment: 'https://buildin.ai/arbstart/share/f6663f42-2600-4657-8eea-619aa19f7cd1?code=FH21BF',
    about: 'https://teachercpa-miniapp.vercel.app/reviews',
    book: 'https://irina-miniapp.vercel.app/book',
    mentor: 'https://t.me/teachercpa_bot',
    channel: 'https://t.me/+dMBhIV90W_01ZjIy',
    outsideBot: 'https://t.me/rstshelp_bot',
  },
  copy: {
    recruitmentBadge: 'Сейчас идет набор',
    recruitmentTitle: 'Подробнее о наборе',
    recruitmentSubtitle: 'Научитесь лить и станьте частью сильного сообщества',
    aboutTitle: 'О команде, кейсы, отзывы',
    aboutSubtitle: 'Реальные результаты и отзывы',
    bookTitle: 'Руководства по арбитражу трафика',
    bookSubtitle: 'Две книги для прибыльных запусков',
    mentorTitle: 'Перейти к наставнику',
    mentorSubtitle: 'Продолжить практику с наставником',
    trustedByTitle: 'Нам доверяют и о нас говорят',
    outsideTitle: 'Откройте страницу в боте @rstshelp_bot',
    outsideDescription: 'Эта страница работает внутри Telegram Mini App.',
    outsideButton: 'Открыть бота',
    staleData: 'Показываем последние данные. Обновим автоматически.',
    updatedNow: 'Обновлено только что',
    updatedMinutes: 'Обновлено {n} мин назад',
    cachedAt: 'Данные от {time}',
    syncError: 'Не удалось обновить данные',
    retry: 'Повторить',
    checkingChanges: 'Проверяем изменения...',
    application: DEFAULT_APPLICATION_COPY,
  },
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_RUNTIME_CONFIG));
}

function safeText(value, fallback, maxLength = 500) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return fallback;
  return normalized;
}

function safeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function safeVersion(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 999999999) return fallback;
  return number;
}

function safeColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function safeResourceOrder(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const allowed = ['recruitment', 'about', 'book', 'trustedBy', 'mentor'];
  const unique = value.filter((key, index) => allowed.includes(key) && value.indexOf(key) === index);
  for (const key of allowed) {
    if (!unique.includes(key)) unique.push(key);
  }
  return unique;
}

function safeUrl(value, fallback) {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function safeInterval(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 15000 || number > 3600000) return fallback;
  return Math.round(number);
}

function mergeApplicationCopy(target, source = {}) {
  for (const state of ['incomplete', 'complete', 'approved', 'terms', 'rejected']) {
    const incoming = source?.[state];
    if (!incoming || typeof incoming !== 'object') continue;
    for (const key of ['status', 'description', 'button', 'hint']) {
      if (key in target[state]) {
        target[state][key] = safeText(incoming[key], target[state][key]);
      }
    }
  }
}

export function mergeRuntimeConfig(source = {}) {
  const result = cloneDefaults();
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;

  result.version = safeVersion(source.version, result.version);
  for (const book of ['profit','beginner']) {
    for (const currency of ['rub','usd']) {
      const value = source.book?.prices?.[book]?.[currency];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1000000) result.book.prices[book][currency] = value;
    }
  }

  if (source.features && typeof source.features === 'object') {
    for (const key of Object.keys(result.features)) {
      result.features[key] = safeBoolean(source.features[key], result.features[key]);
    }
  }

  if (source.telegram && typeof source.telegram === 'object') {
    result.telegram.requestFullscreen = safeBoolean(source.telegram.requestFullscreen, result.telegram.requestFullscreen);
  }

  if (source.ui && typeof source.ui === 'object') {
    result.ui.accent = safeColor(source.ui.accent, result.ui.accent);
    result.ui.accentSecondary = safeColor(source.ui.accentSecondary, result.ui.accentSecondary);
    result.ui.resourceOrder = safeResourceOrder(source.ui.resourceOrder, result.ui.resourceOrder);
    result.ui.showFreshness = safeBoolean(source.ui.showFreshness, result.ui.showFreshness);
    result.ui.animations = safeBoolean(source.ui.animations, result.ui.animations);
  }

  if (source.polling && typeof source.polling === 'object') {
    for (const key of Object.keys(result.polling)) {
      result.polling[key] = safeInterval(source.polling[key], result.polling[key]);
    }
  }

  if (source.links && typeof source.links === 'object') {
    for (const key of Object.keys(result.links)) {
      result.links[key] = safeUrl(source.links[key], result.links[key]);
    }
  }

  if (source.copy && typeof source.copy === 'object') {
    for (const key of [
      'recruitmentBadge', 'recruitmentTitle', 'recruitmentSubtitle',
      'aboutTitle', 'aboutSubtitle', 'bookTitle', 'bookSubtitle',
      'mentorTitle', 'mentorSubtitle', 'trustedByTitle', 'outsideTitle', 'outsideDescription',
      'outsideButton', 'staleData', 'updatedNow', 'updatedMinutes', 'cachedAt',
      'syncError', 'retry', 'checkingChanges',
    ]) {
      result.copy[key] = safeText(source.copy[key], result.copy[key]);
    }
    mergeApplicationCopy(result.copy.application, source.copy.application);
  }

  return result;
}

export function getProfilePollInterval(profileData = {}, config = DEFAULT_RUNTIME_CONFIG) {
  const polling = config?.polling || DEFAULT_RUNTIME_CONFIG.polling;
  if (profileData?.hasPaymentTag || profileData?.receivedTerms) return polling.finalMs;
  if (profileData?.applicationApproved) return polling.approvedMs;
  if (profileData?.applicationCompleted) return polling.pendingMs;
  return polling.idleMs;
}
