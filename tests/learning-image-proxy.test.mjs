import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=path=>fs.readFile(new URL(path,import.meta.url),'utf8');

test('images from learning material are proxied through the Irina origin',async()=>{
 const js=await read('../learning.js');
 const from=js.indexOf('function markdownInline(raw){');
 const to=js.indexOf('async function showLesson(section,id){');
 assert.ok(from>=0 && to>from,'markdown renderer must exist');
 const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const factory=new Function('esc',
   'const lessonMap=new Map(),activeSection="creatives",lessonHref=()=>"/practice";'+js.slice(from,to)+';return renderMarkdown;');
 const render=factory(esc);
 for(const extension of ['png','webp','php']){
   const fixture='![Скриншот 1](https://irina-learning-api.cpateammail.workers.dev/media/assets/69a5b265-3669-41b4-987f-7d834fadfd26.'+extension+')';
   const html=render(fixture);
   assert.match(html,/src="\/learning-media\/assets\/69a5b265-3669-41b4-987f-7d834fadfd26\./);
   assert.doesNotMatch(html,/src="https:\/\/irina-learning-api/);
   assert.match(html,/<figure class="lesson-figure">/);
 }
});

test('Vercel rewrites only lesson asset requests to Cloudflare',async()=>{
 const vercel=JSON.parse(await read('../vercel.json'));
 const route=vercel.rewrites?.find(x=>x.source==='/learning-media/assets/:filename');
 assert.deepEqual(route,{
   source:'/learning-media/assets/:filename',
   destination:'https://irina-learning-api.cpateammail.workers.dev/media/assets/:filename',
 });
 assert.ok(vercel.headers.some(x=>x.headers?.some(h=>h.key==='Cache-Control'&&h.value.includes('no-store'))));
});

test('learning pages load a refreshed script URL on mobile WebViews',async()=>{
 for(const page of ['practice.html','theory.html']){
   const html=await read('../'+page);
   assert.match(html,/src="\/learning.js\?v=20261017-same-origin-media-1"/);
 }
});
