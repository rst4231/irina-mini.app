import { formatRussianDayMonth, normalizeTelegramUser } from './profile.js';
import { getApplicationViewState } from './application.js';

const telegram = window.Telegram?.WebApp;
const loadingScreen = document.getElementById('loading-screen');
const appShell = document.getElementById('app-shell');
const outsideTelegramScreen = document.getElementById('outside-telegram-screen');
const appContent = document.querySelector('.app-content');
const hasTelegramContext = Boolean(telegram?.initData);

if (hasTelegramContext) {
  telegram.ready();
  telegram.expand();
}

const user = telegram?.initDataUnsafe?.user;
const profile = normalizeTelegramUser(user);
const avatar = document.getElementById('profile-avatar');
const initial = document.getElementById('profile-initial');
const name = document.getElementById('profile-name');
const username = document.getElementById('profile-username');
const date = document.getElementById('profile-date');
const applicationCard = document.getElementById('application-card');
const applicationIcon = document.querySelector('.application-icon');
const applicationStatus = document.getElementById('application-status');
const applicationDescription = document.getElementById('application-description');
const applicationButton = document.getElementById('application-button');
const applicationHint = document.getElementById('application-hint');
const joinTeamButton = document.getElementById('join-team-button');
const aboutButton = document.getElementById('about-button');
const bookButton = document.getElementById('book-button');
const trustedByBlock = document.getElementById('trusted-by');
const mentorButton = document.getElementById('mentor-button');
const footerYear = document.getElementById('footer-year');
const footerChannel = document.getElementById('footer-channel');

const APPLICATION_ICONS = {
  form: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M6 3h9l4 4v14H6V3Zm8 1.8V8h3.2L14 4.8ZM9 12h7v2H9v-2Zm0 4h7v2H9v-2Z"/></svg>',
  pending: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-2.1-5l-2.4 2.4H21V3l-2.7 2.7A9 9 0 0 0 12 3Zm-1 4h2v5.2l3.5 2.1-1 1.7-4.5-2.7V7Z"/></svg>',
  approved: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M12 2.8 15 5l3.7.1 1.1 3.5 2.2 3-2.2 3-1.1 3.5-3.7.1-3 2.2-3-2.2-3.7-.1-1.1-3.5-2.2-3 2.2-3 1.1-3.5L9 5l3-2.2Zm-1.2 12.6 6-6-1.4-1.4-4.6 4.6-2.2-2.2-1.4 1.4 3.6 3.6Z"/></svg>',
  terms: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M5 3h14v18H5V3Zm3 4h8V5H8v2Zm0 4h8V9H8v2Zm0 4h5v-2H8v2Zm7.2 3.4 4.1-4.1-1.4-1.4-2.7 2.7-1.2-1.2-1.4 1.4 2.6 2.6Z"/></svg>',
};

let previousApplicationTone = null;

function hapticImpact(style = 'light') {
  try {
    telegram?.HapticFeedback?.impactOccurred?.(style);
  } catch {}
}

function hapticSuccess() {
  try {
    telegram?.HapticFeedback?.notificationOccurred?.('success');
  } catch {}
}

function setApplicationLoading(loading) {
  applicationCard.classList.toggle('is-loading', loading);
  applicationCard.setAttribute('aria-busy', loading ? 'true' : 'false');
}

name.textContent = profile.name;
date.textContent = formatRussianDayMonth();
initial.textContent = profile.initial;
footerYear.textContent = new Date().getFullYear();

if (profile.username) {
  username.textContent = profile.username;
  username.hidden = false;
} else {
  username.hidden = true;
}

if (profile.photoUrl) {
  avatar.src = profile.photoUrl;
  avatar.hidden = false;
  initial.hidden = true;
  avatar.addEventListener('error', () => {
    avatar.hidden = true;
    initial.hidden = false;
  }, { once: true });
} else {
  avatar.hidden = true;
  initial.hidden = false;
}

function renderApplicationStatus(data) {
  const state = getApplicationViewState({
    completed: Boolean(data?.applicationCompleted),
    approved: Boolean(data?.applicationApproved),
    receivedTerms: Boolean(data?.receivedTerms),
  });

  setApplicationLoading(false);
  applicationCard.classList.remove('is-incomplete', 'is-complete', 'is-approved', 'is-terms');
  applicationCard.classList.add(`is-${state.tone}`);
  applicationIcon.innerHTML = APPLICATION_ICONS[state.icon] || APPLICATION_ICONS.form;
  applicationStatus.textContent = state.status;

  if (state.tone === 'terms') {
    applicationDescription.textContent = 'Условия готовы. Посмотрите детали участия';
  } else if (state.tone === 'approved') {
    applicationDescription.textContent = 'Анкета одобрена. Обсудите условия участия';
  } else if (state.tone === 'complete') {
    applicationDescription.textContent = 'Анкета отправлена. Ожидайте результат проверки';
  } else {
    applicationDescription.textContent = 'Заполните короткую анкету и обсудите условия';
  }

  if (previousApplicationTone && previousApplicationTone !== state.tone) {
    const reachedPositiveState = state.tone === 'approved' || state.tone === 'terms';
    if (reachedPositiveState) hapticSuccess();
  }
  previousApplicationTone = state.tone;

  if (state.action) {
    applicationButton.innerHTML = `${state.action.label} <span class="application-arrow" aria-hidden="true">→</span>`;
    applicationButton.href = state.action.url;
    applicationButton.target = state.action.target || '_self';
    applicationButton.dataset.closeMiniApp = state.action.closeMiniApp ? 'true' : 'false';
    applicationHint.textContent = state.action.hint || '';
    applicationHint.hidden = !state.action.hint;

    if (state.action.target === '_blank') {
      applicationButton.rel = 'noopener noreferrer';
    } else {
      applicationButton.removeAttribute('rel');
    }
    applicationButton.hidden = false;
  } else {
    applicationButton.hidden = true;
    applicationHint.hidden = true;
    applicationButton.removeAttribute('href');
    applicationButton.removeAttribute('target');
    applicationButton.removeAttribute('rel');
    applicationButton.removeAttribute('data-close-mini-app');
  }
}

applicationButton.addEventListener('click', (event) => {
  hapticImpact('medium');
  if (applicationButton.dataset.closeMiniApp !== 'true') return;
  if (!hasTelegramContext || typeof telegram?.openTelegramLink !== 'function' || typeof telegram?.close !== 'function') return;
  const url = applicationButton.href;
  if (!url.startsWith('https://t.me/')) return;
  event.preventDefault();
  telegram.openTelegramLink(url);
  setTimeout(() => telegram.close(), 120);
});

document.querySelectorAll('.resource-button, .footer-telegram-icon').forEach((element) => {
  element.addEventListener('click', () => hapticImpact('light'));
});

async function loadSendPulseProfile(signal, { silent = false } = {}) {
  if (!telegram?.initData) return;

  try {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegram.initData }),
      signal,
    });

    if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);

    const data = await response.json();
    const sendPulseName = typeof data?.sendPulseName === 'string' ? data.sendPulseName.trim() : '';
    name.textContent = sendPulseName || profile.name;

    const hasPaymentTag = Boolean(data?.hasPaymentTag);
    appContent?.classList.toggle('has-payment', hasPaymentTag);
    applicationCard.hidden = hasPaymentTag;
    joinTeamButton.hidden = hasPaymentTag;
    aboutButton.hidden = hasPaymentTag;
    bookButton.hidden = hasPaymentTag;
    trustedByBlock.hidden = hasPaymentTag;
    mentorButton.hidden = !hasPaymentTag;
    footerChannel.hidden = hasPaymentTag;

    if (!hasPaymentTag) {
      renderApplicationStatus(data);
    } else {
      setApplicationLoading(false);
    }
  } catch (error) {
    if (error?.name === 'AbortError' && silent) return;
    setApplicationLoading(false);
    if (!silent) {
      applicationCard.classList.remove('is-incomplete', 'is-complete', 'is-approved', 'is-terms');
      applicationCard.classList.add('is-incomplete');
      applicationIcon.innerHTML = APPLICATION_ICONS.form;
      applicationStatus.textContent = 'Не удалось проверить анкету';
      applicationDescription.textContent = 'Попробуйте открыть приложение ещё раз';
      applicationButton.hidden = true;
      applicationHint.hidden = true;
    }
  }
}

async function startApp() {
  if (!hasTelegramContext) {
    loadingScreen.hidden = true;
    appShell.hidden = true;
    outsideTelegramScreen.hidden = false;
    return;
  }

  loadingScreen.hidden = true;
  appShell.hidden = false;

  const controller = new AbortController();
  const maxWaitTimer = setTimeout(() => controller.abort(), 5000);
  await loadSendPulseProfile(controller.signal);
  clearTimeout(maxWaitTimer);
}

startApp();

if (hasTelegramContext) {
  setInterval(() => {
    loadSendPulseProfile(undefined, { silent: true });
  }, 300000);
}
