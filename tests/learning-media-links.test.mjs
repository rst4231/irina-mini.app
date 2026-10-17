import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');

test('lesson renderer includes Cloudflare images, link buttons, and video buttons', async () => {
  const js = await read('../learning.js');
  const css = await read('../learning.css');
  assert.ok(js.includes('lesson-figure'));
  assert.ok(js.includes('irina-learning-api\\.cpateammail\\.workers\\.dev\\/media'));
  assert.ok(js.includes('article-link-btn'));
  assert.ok(js.includes('const video ='));
  assert.ok(css.includes('.lesson-figure img'));
  assert.ok(css.includes('.article-link-btn.video'));
});

test('media Worker serves KV images and does not contain temporary import endpoint', async () => {
  const worker = await read('../cloudflare/irina-learning-api.js');
  assert.ok(worker.includes('LEARNING_MEDIA.get'));
  assert.ok(worker.includes('/media/assets/'));
  assert.ok(!worker.includes('__irina_restore'));
});

test('paid lesson authorization still requires confirmed SendPulse access', async () => {
  const worker = await read('../cloudflare/irina-learning-api.js');
  assert.ok(worker.includes('AUTH_URL'));
  assert.ok(worker.includes('authorized!==true'));
});

test('actual markdown image, video and regular links render as intended', async () => {
  const src = await read('../learning.js');
  const start = src.indexOf('function markdownInline(raw){');
  const end = src.indexOf('async function showLesson(section,id){');
  assert.ok(start >= 0 && end > start);
  const source = src.slice(start,end);
  const factory = new Function(
    'const lessonMap=new Map(); const activeSection="creatives";'+
    'const lessonHref=()=>"/practice";'+
    'const esc=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");'+
    source+';return renderMarkdown;'
  );
  const render = factory();
  const screenshot=render('![Скриншот 1](https://irina-learning-api.cpateammail.workers.dev/media/assets/69a5b265-3669-41b4-987f-7d834fadfd26.png)');
  assert.match(screenshot, /<figure class="lesson-figure"><img /);
  assert.doesNotMatch(screenshot, /<p>!\[/);
  const video=render('[🎥 Видео-инструкция](https://drive.google.com/file/d/example/view)');
  assert.match(video, /class="article-link-btn video"/);
  const normal=render('[Полезный материал](https://example.com/)');
  assert.match(normal, /class="article-link-btn"/);
  assert.doesNotMatch(normal, /class="article-link-btn video"/);
});
