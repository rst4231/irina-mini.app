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
  terms: {
    status: 'Условия готовы',
    description: 'Условия готовы. Посмотрите детали участия',
    button: 'Посмотреть условия',
  },
};

export const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  version: 1,
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
    viewTerms: 'https://buildin.ai/arbstart/share/292c0b0f-8ae4-483a-89f7-4892ed10b70f',
    recruitment: 'https://buildin.ai/arbstart/share/f6663f42-2600-4657-8eea-619aa19f7cd1?code=FH21BF',
    about: 'https://buildin.ai/arbstart/share/cb16c32d-8205-455c-bb89-ac9ad98534df?code=FH21BF',
    book: 'https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387',
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
    bookTitle: 'Как лить в плюс. Арбитраж трафика',
    bookSubtitle: 'Руководство по арбитражу трафика',
    mentorTitle: 'Перейти к наставнику',
    mentorSubtitle: 'Продолжить практику с наставником',
    trustedByTitle: 'Нам доверяют и о нас говорят',
    outsideTitle: 'Откройте страницу в боте @rstshelp_bot',
    outsideDescription: 'Эта страница работает внутри Telegram Mini App.',
    outsideButton: 'Открыть бота',
    staleData: 'Показываем последние данные. Обновим автоматически.',
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
  for (const state of ['incomplete', 'complete', 'approved', 'terms']) {
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

  if (source.features && typeof source.features === 'object') {
    for (const key of Object.keys(result.features)) {
      result.features[key] = safeBoolean(source.features[key], result.features[key]);
    }
  }

  if (source.telegram && typeof source.telegram === 'object') {
    result.telegram.requestFullscreen = safeBoolean(source.telegram.requestFullscreen, result.telegram.requestFullscreen);
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
      'outsideButton', 'staleData',
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
