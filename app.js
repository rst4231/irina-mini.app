import { normalizeTelegramUser, formatProfileDate } from './profile.js';
import { resolveLaunchData } from './learning-auth-session.js';
import { DEFAULT_RUNTIME_CONFIG, mergeRuntimeConfig } from './runtime-config.js';
import { getStoredJson, normalizeInsets, resolveTheme, setStoredJson } from './telegram-runtime.js';

const t = (text, values) => window.AppLanguage?.t(text, values) || text;

const telegram = window.Telegram?.WebApp;
// Signed Telegram login survives navigation to theory and paid lessons.
try { resolveLaunchData(telegram?.initData || '', window.sessionStorage); }
catch { /* Browsers with disabled storage still support live Telegram auth. */ }
const hasTelegramContext = Boolean(telegram?.initData);
if(hasTelegramContext){
  // Nonblocking and idempotent: create the LH STORE personal account as soon as Irina opens.
  // Server always verifies the Telegram signature; no browser user IDs are trusted.
  fetch('/api/store/account',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({initData:telegram.initData,action:'list',page:0}),
    cache:'no-store'
  }).catch(()=>{});
}

const user = telegram?.initDataUnsafe?.user;
const profile = normalizeTelegramUser(user);

function getGreetingName() {
  const telegramName = String(user?.first_name || '').trim() || profile.name;
  return telegramName.trim().split(/\s+/)[0] || 'Пользователь';
}

const CONFIG_STORAGE_KEY = 'irina.runtime-config.v1';
const APP_VERSION_STORAGE_KEY = 'irina.app-version.v1';
const APP_VERSION_CHECK_INTERVAL_MS = 60000;
const REFRESH_COOLDOWN_MS = 1200;

const loadingScreen = document.getElementById('loading-screen');
const appShell = document.getElementById('app-shell');
const outsideTelegramScreen = document.getElementById('outside-telegram-screen');
const appContent = document.querySelector('.app-content');
const avatar = document.getElementById('profile-avatar');
const initial = document.getElementById('profile-initial');
const name = document.getElementById('profile-name');
const profileDate = document.getElementById('profile-date');
const applicationCard = document.getElementById('application-card');
const applicationIcon = document.querySelector('.application-icon');
const applicationStatus = document.getElementById('application-status');
const applicationDescription = document.getElementById('application-description');
const applicationButton = document.getElementById('application-button');
const applicationHint = document.getElementById('application-hint');
const applicationSyncHint = document.getElementById('application-sync-hint');
const freshnessIndicator = document.getElementById('freshness-indicator');
const syncError = document.getElementById('sync-error');
const syncErrorText = document.getElementById('sync-error-text');
const syncRetryButton = document.getElementById('sync-retry-button');
const resourceButtons = document.querySelector('.resource-buttons');
const joinTeamButton = document.getElementById('join-team-button');
const aboutButton = document.getElementById('about-button');
const bookButton = document.getElementById('book-button');
const accountStoreButton = document.getElementById('account-store-button');
const theoryButton = document.getElementById('theory-button');
const practiceButton = document.getElementById('practice-button');
const trustedByBlock = document.getElementById('trusted-by');
const mentorButton = document.getElementById('mentor-button');
const footerYear = document.getElementById('footer-year');
const footerChannel = document.getElementById('footer-channel');
const appVersion = document.getElementById('app-version');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

let runtimeConfig = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
let configTimer = null;
let versionTimer = null;
let freshnessTimer = null;
let configLoadInFlight = false;
let versionCheckInFlight = false;
let versionReloadScheduled = false;
let fullscreenRequestedByApp = false;
let lastRefreshRequestAt = 0;

function hapticImpact(style = 'light') {
  try { telegram?.HapticFeedback?.impactOccurred?.(style); } catch {}
}

function getStoredAppVersion() {
  try {
    return window.localStorage.getItem(APP_VERSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredAppVersion(version) {
  try {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, version);
  } catch {}
}

function reloadForAppUpdate() {
  if (versionReloadScheduled) return;
  versionReloadScheduled = true;
  clearTimeout(versionTimer);

  const url = new URL(window.location.href);
  url.searchParams.set('_appv', Date.now().toString(36));
  window.location.replace(url.toString());
}

function scheduleVersionCheck() {
  if (versionReloadScheduled) return;
  clearTimeout(versionTimer);
  versionTimer = setTimeout(() => checkAppVersion(), APP_VERSION_CHECK_INTERVAL_MS);
}

async function checkAppVersion() {
  if (versionCheckInFlight || versionReloadScheduled) return;
  versionCheckInFlight = true;

  try {
    const response = await fetch(`/api/version?_fresh=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Version request failed: ${response.status}`);

    const payload = await response.json();
    const release = typeof payload?.release === 'string' ? payload.release.trim() : '';
    if (release && appVersion) appVersion.textContent = release;

    const version = typeof payload?.version === 'string' ? payload.version.trim() : '';
    if (!version) return;

    const previousVersion = getStoredAppVersion();
    setStoredAppVersion(version);

    if (previousVersion && previousVersion !== version) {
      reloadForAppUpdate();
    }
  } catch {
    // A failed version check must never block the app.
  } finally {
    versionCheckInFlight = false;
    scheduleVersionCheck();
  }
}

function showSyncError(show) {
  if (!syncError) return;
  syncError.hidden = !show;
  if (show && syncErrorText) syncErrorText.textContent = t(runtimeConfig.copy.syncError);
  if (syncRetryButton) syncRetryButton.textContent = t(runtimeConfig.copy.retry);
}

function renderProfileDate() {
  if (profileDate) profileDate.textContent = formatProfileDate(new Date(),window.AppLanguage?.language || 'ru');
}

function scheduleFreshnessTick() {
  clearTimeout(freshnessTimer);
  freshnessTimer = setTimeout(() => {
    renderProfileDate();
    scheduleFreshnessTick();
  }, 30000);
}

function refreshAppState({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastRefreshRequestAt < REFRESH_COOLDOWN_MS) return;
  lastRefreshRequestAt = now;
  checkAppVersion();
  loadRuntimeConfig({ silent: true });
  renderProfileDate();
}

function reorderResources() {
  if (!resourceButtons) return;
  const nodes = {
    recruitment: joinTeamButton,
    about: aboutButton,
    book: bookButton,
    theory: theoryButton,
    practice: practiceButton,
    trustedBy: trustedByBlock,
    mentor: mentorButton,
  };
  for (const key of runtimeConfig.ui.resourceOrder) {
    const node = nodes[key];
    if (node) resourceButtons.appendChild(node);
  }
  // Always keep the educational resources immediately above the guides.
  if (bookButton?.parentElement === resourceButtons) bookButton.before(theoryButton, practiceButton);
  // Keep LH STORE immediately below Guides regardless of remote resource order.
  if(bookButton?.parentElement===resourceButtons && accountStoreButton?.parentElement===resourceButtons)bookButton.after(accountStoreButton);
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
  if (titleElement) titleElement.textContent = t(title);
  if (subtitleElement) subtitleElement.textContent = t(subtitle);
  if (badgeElement && badge) badgeElement.textContent = t(badge);
  if (title) button.setAttribute('aria-label', t(title));
}

function renderVisibility() {
  appContent?.classList.remove('has-payment');
  applicationCard.hidden = true;
  joinTeamButton.hidden = !runtimeConfig.features.recruitment;
  aboutButton.hidden = !runtimeConfig.features.about;
  bookButton.hidden = !runtimeConfig.features.book;
  theoryButton.hidden = !runtimeConfig.features.theory;
  practiceButton.hidden = !runtimeConfig.features.practice;
  accountStoreButton.hidden = !runtimeConfig.features.store;
  trustedByBlock.hidden = !runtimeConfig.features.trustedBy;
  mentorButton.hidden = !runtimeConfig.features.mentor;
  footerChannel.hidden = !runtimeConfig.features.channel;
  if (freshnessIndicator) freshnessIndicator.hidden = true;
}

function applyRuntimeConfig(config) {
  runtimeConfig = mergeRuntimeConfig(config);
  document.documentElement.style.setProperty('--app-accent', runtimeConfig.ui.accent);
  document.documentElement.style.setProperty('--app-accent-2', runtimeConfig.ui.accentSecondary);
  reorderResources();

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
  setResourceContent(theoryButton, {
    title: runtimeConfig.copy.theoryTitle,
    subtitle: runtimeConfig.copy.theorySubtitle,
    url: runtimeConfig.links.theory,
  });
  setResourceContent(practiceButton, {
    title: runtimeConfig.copy.practiceTitle,
    subtitle: runtimeConfig.copy.practiceSubtitle,
    url: runtimeConfig.links.practice,
  });
  setResourceContent(bookButton, {
    title: runtimeConfig.copy.bookTitle,
    subtitle: runtimeConfig.copy.bookSubtitle,
    url: runtimeConfig.links.book,
  });
  setResourceContent(accountStoreButton, {title:runtimeConfig.copy.storeTitle,subtitle:runtimeConfig.copy.storeSubtitle,url:'https://irina-miniapp.vercel.app/store'});
  setResourceContent(mentorButton, {
    title: runtimeConfig.copy.mentorTitle,
    subtitle: runtimeConfig.copy.mentorSubtitle,
    url: runtimeConfig.links.mentor,
  });
  footerChannel.href = runtimeConfig.links.channel;

  const trustedTitle = trustedByBlock.querySelector('.trusted-by-title');
  if (trustedTitle?.childNodes?.[1]) trustedTitle.childNodes[1].nodeValue = t(runtimeConfig.copy.trustedByTitle);

  const outsideTitle = outsideTelegramScreen.querySelector('h1');
  const outsideDescription = outsideTelegramScreen.querySelector('p');
  const outsideButton = outsideTelegramScreen.querySelector('.outside-telegram-button');
  if (outsideTitle) outsideTitle.textContent = t(runtimeConfig.copy.outsideTitle);
  if (outsideDescription) outsideDescription.textContent = t(runtimeConfig.copy.outsideDescription);
  if (outsideButton) {
    outsideButton.textContent = t(runtimeConfig.copy.outsideButton);
    outsideButton.href = runtimeConfig.links.outsideBot;
  }

  renderVisibility();
  renderProfileDate();
  showSyncError(false);
  maybeSyncFullscreen();
  scheduleConfigRefresh();
}

function isCurrentCachedConfig(cached) {
  return Number(cached?.config?.version) >= DEFAULT_RUNTIME_CONFIG.version;
}

async function loadCachedConfig() {
  const cached = await getStoredJson(telegram, CONFIG_STORAGE_KEY);
  if (isCurrentCachedConfig(cached)) applyRuntimeConfig(cached.config);
}

async function loadRuntimeConfig({ silent = false } = {}) {
  if (configLoadInFlight) return;
  configLoadInFlight = true;
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
      if (isCurrentCachedConfig(cached)) applyRuntimeConfig(cached.config);
    }
  } finally {
    configLoadInFlight = false;
    scheduleConfigRefresh();
  }
}

function scheduleConfigRefresh() {
  clearTimeout(configTimer);
  configTimer = setTimeout(() => loadRuntimeConfig({ silent: true }), runtimeConfig.polling.configMs);
}

// Remember the Telegram launch URL only when entering the book page from
// this Mini App. Returning Home then restores the original Telegram context.
// Save the original Mini App launch context for Home on the learning pages.
[theoryButton, practiceButton].forEach(button => button?.addEventListener('click', () => {
  try {
    if (hasTelegramContext) {
      sessionStorage.setItem('irina_learning_home_context', JSON.stringify({url:window.location.href,savedAt:Date.now()}));
    } else sessionStorage.removeItem('irina_learning_home_context');
  } catch { /* Private browser storage can be unavailable. */ }
}));

bookButton?.addEventListener('click', () => {
  try {
    const key = 'irina_book_home_context';
    if (hasTelegramContext) {
      sessionStorage.setItem(key, JSON.stringify({url:window.location.href, savedAt:Date.now()}));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be disabled in some embedded browsers. */ }
});

document.querySelectorAll('.resource-button, .footer-telegram-icon').forEach((element) => {
  element.addEventListener('click', () => hapticImpact('light'));
});

syncRetryButton?.addEventListener('click', () => {
  hapticImpact('light');
  showSyncError(false);
  refreshAppState({ force: true });
});

name.textContent = t('Привет, {name}!',{name:t(getGreetingName())});
initial.textContent = profile.initial;
footerYear.textContent = new Date().getFullYear();
scheduleFreshnessTick();

renderProfileDate();

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
  telegram.onEvent?.('activated', refreshAppState);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAppState();
});
window.addEventListener('focus', refreshAppState);
window.addEventListener('pageshow', refreshAppState);

async function startApp() {
  checkAppVersion();
  await loadCachedConfig();
  loadRuntimeConfig({ silent: true });

  if (!hasTelegramContext) {
    loadingScreen.hidden = true;
    appShell.hidden = true;
    outsideTelegramScreen.hidden = false;
    return;
  }

  loadingScreen.hidden = true;
  appShell.hidden = false;
  renderVisibility();
}

window.addEventListener('irinalanguagechange', () => {
  applyRuntimeConfig(runtimeConfig);
  name.textContent = t('Привет, {name}!',{name:t(getGreetingName())});
});

startApp();
