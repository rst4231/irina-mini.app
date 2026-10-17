import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('learning pages render imported Cloudflare images and style standard and video links',async()=>{
 const js=await fs.readFile(new URL('../learning.js',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../learning.css',import.meta.url),'utf8');
 assert.match(js,/lesson-figure/);
 assert.match(js,/irina-learning-api\\.cpateammail\\.workers\\.dev\\/media/);
 assert.match(js,/article-link-btn/);
 assert.match(js,/const video =/);
 assert.match(css,/\\.lesson-figure img/);
 assert.match(css,/\\.article-link-btn\\.video/);
});

test('media Worker serves images from Cloudflare KV without reactivating the import endpoint',async()=>{
 const worker=await fs.readFile(new URL('../cloudflare/irina-learning-api.js',import.meta.url),'utf8');
 assert.match(worker,/LEARNING_MEDIA\\.get/);
 assert.match(worker,/media\\/assets/);
 assert.doesNotMatch(worker,/__irina_restore/);
});

test('paid-lesson validation still delegates to SendPulse authorization',async()=>{
 const worker=await fs.readFile(new URL('../cloudflare/irina-learning-api.js',import.meta.url),'utf8');
 assert.match(worker,/AUTH_URL/);
 assert.match(worker,/authorized!==true/);
});
