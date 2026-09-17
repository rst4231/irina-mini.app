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
applicationIcon.textContent = state.icon;
applicationStatus.textContent = state.status;
applicationStatus.classList.remove('is-complete', 'is-approved');
if (state.tone === 'complete') applicationStatus.classList.add('is-complete');
if (state.tone === 'approved') applicationStatus.classList.add('is-approved');
if (data?.receivedTerms) {
applicationDescription.textContent = 'Условия готовы. Посмотрите детали участия';
} else if (data?.applicationApproved) {
applicationDescription.textContent = 'Анкета одобрена. Обсудите условия участия';
} else if (data?.applicationCompleted) {
applicationDescription.textContent = 'Анкета отправлена. Ожидайте результат проверки';
} else {
applicationDescription.textContent = 'Заполните короткую анкету и обсудите условия';
}
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
if (applicationButton.dataset.closeMiniApp !== 'true') return;
if (!hasTelegramContext || typeof telegram?.openTelegramLink !== 'function' || typeof telegram?.close !== 'function') return;
const url = applicationButton.href;
if (!url.startsWith('https://t.me/')) return;
event.preventDefault();
telegram.openTelegramLink(url);
setTimeout(() => telegram.close(), 120);
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
if (!response.ok) return;
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
}
} catch {
if (!silent) {
applicationStatus.textContent = 'Не удалось проверить анкету';
applicationDescription.textContent = 'Попробуйте открыть приложение ещё раз';
applicationButton.hidden = true;
}
}
}
function wait(ms) {
return new Promise((resolve) => setTimeout(resolve, ms));
}
async function startApp() {
if (!hasTelegramContext) {
loadingScreen.hidden = true;
appShell.hidden = true;
outsideTelegramScreen.hidden = false;
return;
}
const controller = new AbortController();
let maxWaitTimer;
const minimumDelay = wait(1500);
const profileLoad = loadSendPulseProfile(controller.signal);
const maximumDelay = new Promise((resolve) => {
maxWaitTimer = setTimeout(() => {
controller.abort();
resolve();
}, 5000);
});
await Promise.race([
Promise.allSettled([profileLoad, minimumDelay]),
maximumDelay,
]);
clearTimeout(maxWaitTimer);
loadingScreen.hidden = true;
appShell.hidden = false;
}
startApp();
if (hasTelegramContext) {
setInterval(() => {
loadSendPulseProfile(undefined, { silent: true });
}, 300000);
}
