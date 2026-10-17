import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function viewerHarness(id, href) {
  const handlers = {};
  const nodes = [];
  class Element {
    constructor(tag) { this.tag = tag; this.style = {}; this.attributes = {}; this.listeners = {}; this.hidden = false; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, callback) { this.listeners[key] = callback; }
    append(...children) { this.children = children; children.forEach((node) => { node.isConnected = true; }); }
    appendChild(child) { this.append(child); }
    closest(selector) { return selector === 'a[href]' ? this : null; }
  }
  const document = {
    head: new Element('head'), body: new Element('body'),
    createElement(tag) { const node = new Element(tag); nodes.push(node); return node; },
    addEventListener(key, callback) { handlers[key] = callback; },
  };
  const history = { state: null, pushState(state) { this.state = state; }, back() { handlers.popstate(); } };
  const window = { location: { href: 'https://irina-miniapp.vercel.app/' }, history,
    addEventListener(key, callback) { handlers[key] = callback; } };
  const source = await readFile(new URL('../recruitment-viewer.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { document, window, Element, URL });
  const anchor = new Element('a'); Object.assign(anchor, { id, href });
  const event = { target: anchor, button: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
  handlers.click(event);
  return { nodes, event, document, handlers };
}

test('terms open inside the app and Back restores the previous screen', async () => {
  const url = 'https://team.arbstart.tech/win-win/';
  const { nodes, event, document, handlers } = await viewerHarness('application-button', url);
  assert.equal(event.defaultPrevented, true);
  const frame = nodes.find((node) => node.tag === 'iframe');
  const viewer = nodes.find((node) => node.tag === 'section');
  assert.equal(frame.src, url);
  assert.equal(frame.title, 'Условия участия');
  assert.equal(nodes.find((node) => node.tag === 'button').attributes['aria-label'], 'Назад');
  assert.equal(viewer.hidden, false);
  assert.equal(document.body.style.overflow, 'hidden');
  handlers.popstate();
  assert.equal(viewer.hidden, true);
  assert.equal(frame.src, 'about:blank');
});

test('other application actions and unrelated team links stay outside this viewer', async () => {
  for (const url of ['https://t.me/rstshelp_bot?start=form', 'https://team.arbstart.tech/start/', 'http://team.arbstart.tech/win-win/', 'https://example.com/win-win/']) {
    const { event, nodes } = await viewerHarness('application-button', url);
    assert.equal(event.defaultPrevented, false, url);
    assert.equal(nodes.length, 0, url);
  }
});

test('recruitment continues opening inside the app', async () => {
  const { nodes, event } = await viewerHarness('join-team-button', 'https://team.arbstart.tech/');
  assert.equal(event.defaultPrevented, true);
  assert.equal(nodes.find((node) => node.tag === 'iframe').title, 'Набор');
});

test('recruitment page opens inside an iframe without a Home button', async () => {
  const source = await readFile(new URL('../recruitment-viewer.js', import.meta.url), 'utf8');
  assert.match(source, /const HOST = 'team\.arbstart\.tech'/);
  assert.match(source, /url\.protocol === 'https:'/);
  assert.match(source, /document\.createElement\('iframe'\)/);
  assert.match(source, /anchor\.id !== buttonId/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /aria-label', 'Закрыть'/);
  assert.doesNotMatch(source, /Домой/);
  new vm.Script(source);
});

test('content security policy allows the HTTPS team page to be embedded', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers.flatMap((entry) => entry.headers || [])
    .find((item) => item.key === 'Content-Security-Policy')?.value || '';
  assert.match(csp, /frame-src[^;]*https:\/\/team\.arbstart\.tech/);
});
