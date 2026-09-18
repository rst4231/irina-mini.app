import { formatRussianDayMonth, normalizeTelegramUser } from './profile.js';
import { getApplicationViewState } from './application.js';
import { DEFAULT_RUNTIME_CONFIG, getProfilePollInterval, mergeRuntimeConfig } from './runtime-config.js';
import { getStoredJson, normalizeInsets, resolveTheme, setStoredJson } from './telegram-runtime.js';

const telegram = window.Telegram?.WebApp;
const hasTelegramContext = Boolean(telegram?.initData);
const user = telegram?.initDataUnsafe?.user;
const profile = normalizeTelegramUser(user);

const PROFILE_STORAGE_KEY = 'irina.profile.v2';
const CONFIG_STORAGE_KEY = 'irina.runtime-config.v1';

const loadingScreen = document.getElementById('loading-screen');
const appShell = document.getElementById('app-shell');
const outsideTelegramScreen = document.getElementById('outside-telegram-screen');
const appContent = document.querySelector('.app-content');
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
const applicationSyncHint = document.getElementById('application-sync-hint');
const joinTeamButton = document.getElementById('join-team-button');
const aboutButton = document.getElementById('about-button');
const bookButton = document.getElementById('book-button');
const trustedByBlock = document.getElementById('trusted-by');
const mentorButton = document.getElementById('mentor-button');
const footerYear = document.getElementById('footer-year');
const footerChannel = document.getElementById('footer-channel');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

const APPLICATION_ICONS = {
  form: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M6 3h9l4 4v14H6V3Zm8 1.8V8h3.2L14 4.8ZM9 12h7v2H9v-2Zm0 4h7v2H9v-2Z"/></svg>',
  pending: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-2.1-5l-2.4 2.4H21V3l-2.7 2.7A9 9 0 0 0 12 3Zm-1 4h2v5.2l3.5 2.1-1 1.7-4.5-2.7V7Z"/></svg>',
  approved: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M12 2.8 15 5l3.7.1 1.1 3.5 2.2 3-2.2 3-1.1 3.5-3.7.1-3 2.2-3-2.2-3.7-.1-1.1-3.5-2.2-3 2.2-3 1.1-3.5L9 5l3-2.2Zm-1.2 12.6 6-6-1.4-1.4-4.6 4.6-2.2-2.2-1.4 1.4 3.6 3.6Z"/></svg>',
  terms: '<svg class="icon-svg" viewBox="0 0 24 24" focusable="false"><path d="M5 3h14v18H5V3Zm3 4h8V5H8v2Zm0 4h8V9H8v2Zm0 4h5v-2H8v2Zm7.2 3.4 4.1-4.1-1.4-1.4-2.7 2.7-1.2-1.2-1.4 1.4 2.6 2.6Z"/></svg>',
};

let runtimeConfig = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
let lastProfileData = null;
let lastProfileStale = false;
let previousApplicationTone = null;
let profileTimer = null;
let configTimer = null;
let profileLoadInFlight = false;
let fullscreenRequestedByApp = false;

function hapticImpact(style = 'light') {
  try { telegram?.HapticFeedback?.impactOccurred?.(style); } catch {}
}

function hapticSuccess() {
  try { telegram?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
}

function setApplicationLoading(loading) {
  applicationCard.classList.toggle('is-loading', loading);
  applicationCard.setAttribute('aria-busy', loading ? 'true' : 'false');
}

function syncTelegramEnvironment() {
  const root = document.documentElement;
  const theme = resolveTheme(telegram || {});
  root.dataset.theme = theme;

  const safe = normalizeInsets(telegram?.safeAreaInset);
  const content = normalizeInsets(telegram?.contentSafeAreaInset);
  const effective = {
    top: Math.max(safe.top, content.top),
    right: Math.max(safe.right, content.right),
    bottom: Math.max(safe.bottom, content.bottom),
    left: Math.max(safe.left, content.left),
  };

  root.style.setProperty('--app-safe-top', `${effective.top}px`);
  root.style.setProperty('--app-safe-right', `${effective.right}px`);
  root.style.setProperty('--app-safe-bottom', `${effective.bottom}px`);
  root.style.setProperty('--app-safe-left', `${effective.left}px`);

  const viewportHeight = Number(telegram?.viewportStableHeight || telegram?.viewportHeight);
  if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
    root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
  }

  const background = theme === 'dark' ? '#111722' : '#f7faff';
  themeColorMeta?.setAttribute('content', background);
  try { telegram?.setHeaderColor?.(background); } catch {}
  try { telegram?.setBackgroundColor?.(background); } catch {}
  try { telegram?.setBottomBarColor?.(background); } catch {}
}

function maybeSyncFullscreen() {
  if (!hasTelegramContext) return;
  const shouldRequest = Boolean(runtimeConfig.telegram?.requestFullscreen);
  if (shouldRequest && !fullscreenRequestedByApp && typeof telegram?.requestFullscreen === 'function') {
    try {
      telegram.requestFullscreen();
      fullscreenRequestedByApp = true;
    } catch {}
  } else if (!shouldRequest && fullscreenRequestedByApp && telegram?.isFullscreen && typeof telegram?.exitFullscreen === 'function') {
    try {
      telegram.exitFullscreen();
      fullscreenRequestedByApp = false;
    } catch {}
  }
}

function setResourceContent(button, { title, subtitle, url, badge }) {
  if (!button) return;
  if (url) button.href = url;
  const titleElement = button.querySelector('.resource-title');
  const subtitleElement = button.querySelector('.resource-subtitle');
  const badgeElement = button.querySelector('.resource-badge');
  if (titleElement) titleElement.textContent = title;
  if (subtitleElement) subtitleElement.textContent = subtitle;
  if (badgeElement && badge) badgeElement.textContent = badge;
  if (title) button.setAttribute('aria-label', title);
}

function renderVisibility() {
  const paid = Boolean(lastProfileData?.hasPaymentTag);
  appContent?.classList.toggle('has-payment', paid);

  applicationCard.hidden = paid;
  joinTeamButton.hidden = paid || !runtimeConfig.features.recruitment;
  aboutButton.hidden = paid || !runtimeConfig.features.about;
  bookButton.hidden = paid || !runtimeConfig.features.book;
  trustedByBlock.hidden = paid || !runtimeConfig.features.trustedBy;
  mentorButton.hidden = !paid || !runtimeConfig.features.mentor;
  footerChannel.hidden = paid || !runtimeConfig.features.channel;
}

function applyRuntimeConfig(config) {
  runtimeConfig = mergeRuntimeConfig(config);

  setResourceContent(joinTeamButton, {
    title: runtimeConfig.copy.recruitmentTitle,
    subtitle: runtimeConfig.copy.recruitmentSubtitle,
    badge: runtimeConfig.copy.recruitmentBadge,
    url: runtimeConfig.links.recruitment,
  });
  setResourceContent(aboutButton, {
    title: runtimeConfig.copy.aboutTitle,
    subtitle: runtimeConfig.copy.aboutSubtitle,
    url: runtimeConfig.links.about,
  });
  setResourceContent(bookButton, {
    title: runtimeConfig.copy.bookTitle,
    subtitle: runtimeConfig.copy.bookSubtitle,
    url: runtimeConfig.links.book,
  });
  setResourceContent(mentorButton, {
    title: runtimeConfig.copy.mentorTitle,
    subtitle: runtimeConfig.copy.mentorSubtitle,
    url: runtimeConfig.links.mentor,
  });
  footerChannel.href = runtimeConfig.links.channel;

  const trustedTitle = trustedByBlock.querySelector('.trusted-by-title');
  if (trustedTitle?.childNodes?.[1]) trustedTitle.childNodes[1].nodeValue = runtimeConfig.copy.trustedByTitle;

  const outsideTitle = outsideTelegramScreen.querySelector('h1');
  const outsideDescription = outsideTelegramScreen.querySelector('p');
  const outsideButton = outsideTelegramScreen.querySelector('.outside-telegram-button');
  if (outsideTitle) outsideTitle.textContent = runtimeConfig.copy.outsideTitle;
  if (outsideDescription) outsideDescription.textContent = runtimeConfig.copy.outsideDescription;
  if (outsideButton) {
    outsideButton.textContent = runtimeConfig.copy.outsideButton;
    outsideButton.href = runtimeConfig.links.outsideBot;
  }

  renderVisibility();
  if (lastProfileData && !lastProfileData.hasPaymentTag) renderApplicationStatus(lastProfileData, { stale: lastProfileStale });
  maybeSyncFullscreen();
  scheduleProfileRefresh();
  scheduleConfigRefresh();
}

function renderApplicationStatus(data, { stale = false } = {}) {
  const state = getApplicationViewState({
    completed: Boolean(data?.applicationCompleted),
    approved: Boolean(data?.applicationApproved),
    receivedTerms: Boolean(data?.receivedTerms),
    config: runtimeConfig,
  });

  setApplicationLoading(false);
  applicationCard.classList.remove('is-incomplete', 'is-complete', 'is-approved', 'is-terms');
  applicationCard.classList.add(`is-${state.tone}`);
  applicationIcon.innerHTML = APPLICATION_ICONS[state.icon] || APPLICATION_ICONS.form;
  applicationStatus.textContent = state.status;
  applicationDescription.textContent = state.description;

  if (previousApplicationTone && previousApplicationTone !== state.tone) {
    if (state.tone === 'approved' || state.tone === 'terms') hapticSuccess();
  }
  previousApplicationTone = state.tone;

  if (state.action) {
    applicationButton.textContent = state.action.label;
    applicationButton.append(' ');
    const arrow = document.createElement('span');
    arrow.className = 'application-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    applicationButton.append(arrow);
    applicationButton.href = state.action.url;
    applicationButton.target = state.action.target || '_self';
    applicationButton.dataset.closeMiniApp = state.action.closeMiniApp ? 'true' : 'false';
    applicationHint.textContent = state.action.hint || '';
    applicationHint.hidden = !state.action.hint;
    if (state.action.target === '_blank') applicationButton.rel = 'noopener noreferrer';
    else applicationButton.removeAttribute('rel');
    applicationButton.hidden = false;
  } else {
    applicationButton.hidden = true;
    applicationHint.hidden = true;
    applicationButton.removeAttribute('href');
    applicationButton.removeAttribute('target');
    applicationButton.removeAttribute('rel');
    applicationButton.removeAttribute('data-close-mini-app');
  }

  applicationSyncHint.textContent = stale ? runtimeConfig.copy.staleData : '';
  applicationSyncHint.hidden = !stale;
}

function renderProfileData(data, { stale = false } = {}) {
  lastProfileData = data;
  lastProfileStale = stale;
  const sendPulseName = typeof data?.sendPulseName === 'string' ? data.sendPulseName.trim() : '';
  name.textContent = sendPulseName || profile.name;
  renderVisibility();
  if (!data?.hasPaymentTag) renderApplicationStatus(data, { stale });
  else setApplicationLoading(false);
}

async function loadCachedConfig() {
  const cached = await getStoredJson(telegram, CONFIG_STORAGE_KEY);
  if (cached?.config) applyRuntimeConfig(cached.config);
}

async function loadRuntimeConfig({ silent = false } = {}) {
  try {
    const response = await fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
    const payload = await response.json();
    if (!payload?.config) throw new Error('Config payload missing');
    applyRuntimeConfig(payload.config);
    await setStoredJson(telegram, CONFIG_STORAGE_KEY, { config: runtimeConfig, savedAt: Date.now() });
  } catch {
    if (!silent) {
      const cached = await getStoredJson(telegram, CONFIG_STORAGE_KEY);
      if (cached?.config) applyRuntimeConfig(cached.config);
    }
  } finally {
    scheduleConfigRefresh();
  }
}

async function getCachedProfile() {
  const cached = await getStoredJson(telegram, PROFILE_STORAGE_KEY);
  if (!cached?.data) return null;
  if (String(cached.telegramId || '') !== String(user?.id || '')) return null;
  return cached;
}

function scheduleProfileRefresh() {
  if (!hasTelegramContext) return;
  clearTimeout(profileTimer);
  const delay = getProfilePollInterval(lastProfileData || {}, runtimeConfig);
  profileTimer = setTimeout(() => loadSendPulseProfile({ silent: true }), delay);
}

function scheduleConfigRefresh() {
  clearTimeout(configTimer);
  configTimer = setTimeout(() => loadRuntimeConfig({ silent: true }), runtimeConfig.polling.configMs);
}

async function loadSendPulseProfile({ silent = false } = {}) {
  if (!telegram?.initData || profileLoadInFlight) return;
  profileLoadInFlight = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegram.initData }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
    const data = await response.json();
    renderProfileData(data, { stale: false });
    await setStoredJson(telegram, PROFILE_STORAGE_KEY, {
      telegramId: String(user?.id || ''),
      data,
      savedAt: Date.now(),
    });
  } catch {
    const cached = await getCachedProfile();
    if (cached?.data) {
      renderProfileData(cached.data, { stale: true });
    } else if (!silent) {
      setApplicationLoading(false);
      applicationCard.classList.remove('is-complete', 'is-approved', 'is-terms');
      applicationCard.classList.add('is-incomplete');
      applicationIcon.innerHTML = APPLICATION_ICONS.form;
      applicationStatus.textContent = 'Не удалось проверить анкету';
      applicationDescription.textContent = 'Попробуйте открыть приложение ещё раз';
      applicationButton.hidden = true;
      applicationHint.hidden = true;
      applicationSyncHint.hidden = true;
    }
  } finally {
    clearTimeout(timeout);
    profileLoadInFlight = false;
    scheduleProfileRefresh();
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

name.textContent = profile.name;
date.textContent = formatRussianDayMonth();
initial.textContent = profile.initial;
footerYear.textContent = new Date().getFullYear();

if (profile.username) {
  username.textContent = profile.username;
  username.hidden = false;
}

if (profile.photoUrl) {
  avatar.src = profile.photoUrl;
  avatar.hidden = false;
  initial.hidden = true;
  avatar.addEventListener('error', () => {
    avatar.hidden = true;
    initial.hidden = false;
  }, { once: true });
}

if (hasTelegramContext) {
  syncTelegramEnvironment();
  telegram.ready();
  telegram.expand();
  for (const event of ['themeChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged', 'fullscreenChanged']) {
    telegram.onEvent?.(event, syncTelegramEnvironment);
  }
  telegram.onEvent?.('activated', () => {
    loadRuntimeConfig({ silent: true });
    loadSendPulseProfile({ silent: true });
  });
}

async function startApp() {
  await loadCachedConfig();
  loadRuntimeConfig({ silent: true });

  if (!hasTelegramContext) {
    loadingScreen.hidden = true;
    appShell.hidden = true;
    outsideTelegramScreen.hidden = false;
    return;
  }

  const cached = await getCachedProfile();
  if (cached?.data) renderProfileData(cached.data, { stale: true });

  loadingScreen.hidden = true;
  appShell.hidden = false;
  await loadSendPulseProfile({ silent: Boolean(cached?.data) });
}

startApp();
