import { resolveLaunchData } from './learning-auth-session.js';
const app = document.getElementById('learning-app');
const page = document.body.dataset.learningPage;
const tg = window.Telegram?.WebApp;
const telegramInitData = () => {
  try { return resolveLaunchData(tg?.initData || '', window.sessionStorage); }
  catch { return resolveLaunchData(tg?.initData || '', null); }
};
const purchaseURL = 'https://t.me/rstshelp_bot?start=6ad360e905eb22d6de058dac';
const sections = [
  {id:'creatives',title:'Создание креативов',description:'Идеи, рекламные подходы, пять гипотез, создание объявлений и техническое задание.',emoji:'✦'},
  {id:'infrastructure',title:'Инфраструктура Facebook Ads',description:'Домены, аккаунты, прокси, антидетект, платёжные инструменты и Pixel.',emoji:'⚙'},
  {id:'keitaro',title:'Трекер Keitaro',description:'Кампании, лендинги, postback, статистика, ошибки настройки и аналитика.',emoji:'◎'},
  {id:'launch',title:'Запуск и анализ рекламы',description:'Таргетинг, тесты, контроль бюджета, оптимизация, ROI и масштабирование.',emoji:'↗'},
];
const homeKey = 'irina_learning_home_context';
let lessons = [];
let lessonMap = new Map();
let settings = {practice_price_stars:'1200',bundle_price_stars:'3600',purchase_url:purchaseURL};
let activeSection = null;
let purchasesPromise = null;
const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function theme(){
  let theme = tg?.colorScheme;
  if (!['dark','light'].includes(theme)) theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme === 'dark' ? '#10192a' : '#f2f7ff');
}
theme();tg?.onEvent?.('themeChanged',theme);
try{tg?.ready?.();tg?.expand?.();}catch{}
function currentQuery(){return new URLSearchParams(location.search);}
function homeURL(){
  try{
    const saved = JSON.parse(sessionStorage.getItem(homeKey) || 'null');
    if(saved && saved.savedAt > Date.now()-6*3600*1000){
      const url = new URL(saved.url);
      if(url.origin === location.origin && url.pathname === '/')return url.href;
    }
  }catch{}
  return '/';
}
const home = document.getElementById('learning-home');
home.href=homeURL();
function goBack(){
  const q = currentQuery();
  if(q.has('lesson')){
    location.assign(page === 'theory' ? '/theory' : '/practice?topic='+encodeURIComponent(q.get('topic')||''));
  } else if(q.has('topic') && page==='practice'){
    location.assign('/practice');
  } else {
    location.assign(homeURL());
  }
}
document.getElementById('learning-back').addEventListener('click',goBack);
function buyButton(label='Купить в боте',cls='button-main'){
  return '<a class="'+cls+'" data-purchase-link href="'+esc(settings.purchase_url||purchaseURL)+'" rel="noopener noreferrer" target="_blank">'+esc(label)+' <span aria-hidden="true">↗</span></a>';
}
document.addEventListener('click',event=>{
  const element=event.target.closest('a[data-purchase-link]');
  if(!element)return;
  if(tg?.openTelegramLink){
    event.preventDefault();
    tg.openTelegramLink(element.href);
  }
});
const LESSONS_PUBLIC_API = 'https://irina-learning-api.cpateammail.workers.dev';
async function fetchLearning(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000), ...options });
  const data = await response.json().catch(() => ({error:'invalid_response'}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(data.error || 'learning_unavailable');
    error.status = response.status;
    throw error;
  }
  return data;
}
async function api(mode, params={}) {
  const backend = () => fetchLearning('/api/learning', {
    method:'POST', headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({mode,...params,initData:telegramInitData()}),
  });
  if(mode==='list' || mode==='catalog'){
    const path=mode==='catalog'?'/catalog':'/list?section='+encodeURIComponent(params.section||'');
    return Promise.any([backend(),fetchLearning(LESSONS_PUBLIC_API+path,{mode:'cors',credentials:'omit'})]);
  }
  return backend();
}
function loadPurchases(){
  if(!purchasesPromise)purchasesPromise=fetchLearning('/api/learning-authorize',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
    body:JSON.stringify({section:'all',initData:telegramInitData()}),
  }).then(data=>Object.fromEntries(sections.map(s=>[s.id,data.access?.[s.id]===true])))
    .catch(error=>error.status===403?Object.fromEntries(sections.map(s=>[s.id,false])):null);
  return purchasesPromise;
}
function purchaseCheckNotice(){
  return '<div class="hint" role="status">Не удалось проверить купленные разделы. Если вы уже оплатили, повторная покупка не нужна. <button class="button-outline" id="retry-purchases" type="button">Проверить ещё раз</button></div>';
}
function bindPurchaseRetry(){
  document.getElementById('retry-purchases')?.addEventListener('click',()=>location.reload());
}
function header(title,subtitle,badges=[]){
  return '<div class="hero"><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p>'+(badges.length?'<div class="hero-data">'+badges.map(t=>'<span class="hero-pill">'+esc(t)+'</span>').join('')+'</div>':'')+'</div>';
}
function failure(message='Не удалось загрузить материалы. Попробуйте ещё раз.'){
  app.innerHTML=header(page==='theory'?'Теория':'Практические инструкции','Материалы доступны внутри Irina.')+'<div class="status">'+esc(message)+'</div><div style="margin-top:15px"><button class="button-outline" id="retry-learning">Повторить</button></div>';
  document.getElementById('retry-learning')?.addEventListener('click',()=>location.reload());
}
const sectionById=(id)=>sections.find(x=>x.id===id);
const lessonHref=(section,id)=>section==='theory'?'/theory?lesson='+encodeURIComponent(id):'/practice?topic='+encodeURIComponent(section)+'&lesson='+encodeURIComponent(id);
function lessonButtons(section,items){
  return '<div class="lesson-list">'+items.map((l,i)=>'<a class="lesson-row can-open" href="'+esc(lessonHref(section,l.id))+'"><span class="num">'+String(i+1).padStart(2,'0')+'</span><span>'+esc(l.title)+'</span><span style="margin-left:auto;color:var(--accent)">›</span></a>').join('')+'</div>';
}
function markdownInline(raw){
  let content=esc(raw).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>{
    const target = url.match(/buildin\.ai\/(?:[^/]+\/share\/)?([a-f0-9-]{36})/);
    const internal = target && lessonMap.has(target[1]);
    const href = internal ? lessonHref(activeSection,target[1]) : url.replace(/&amp;/g,'&');
    if(!/^https:\/\//.test(href)&&!href.startsWith('/'))return esc(label);
    const video = /(?:youtu(?:be)?\.(?:com|be)|vimeo\.com|rutube\.ru|vkvideo\.ru|\/videos?\/|\/file\/d\/)/i.test(href) || /🎥|📹|видео|видеоурок|видеогайд|посмотреть ролик/i.test(label.replace(/<[^>]*>/g,''));
    return '<a class="article-link-btn'+(video?' video':'')+'" href="'+esc(href)+'"'+(internal?'':' target="_blank" rel="noopener noreferrer"')+'>'+label+'</a>';
  });
  content=content.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
  content=content.replace(/`([^`]+)`/g,'<code>$1</code>');
  return content;
}
function renderMarkdown(source){
  const cleaned=String(source||'')
    .replace(/<summary>/gi,'\n### ').replace(/<\/summary>/gi,'\n')
    .replace(/<\/?details[^>]*>/gi,'\n')
    .replace(/<br\s*\/?>/gi,'\n').replace(/\r\n?/g,'\n');
  const lines=cleaned.split('\n');
  let output='',paragraph=[],list=null,quote=[],code=[],inCode=false;
  const flushParagraph=()=>{
    if(!paragraph.length)return;
    const value=paragraph.join(' ').trim();
    const note=value.match(/^\*\*(Важно|Совет|Пример|Обратите внимание|Проверьте|Запомните):?\*\*\s*(.*)$/i);
    if(note)output+='<aside class="lesson-note"><span class="lesson-note-heading">'+markdownInline(note[1])+'</span><div>'+markdownInline(note[2]||'')+'</div></aside>';
    else output+='<p>'+markdownInline(value)+'</p>';
    paragraph=[];
  };
  const closeList=()=>{if(list){output+='</'+list+'>';list=null;}};
  const flushQuote=()=>{if(quote.length){output+='<blockquote>'+quote.map(markdownInline).join(' ')+'</blockquote>';quote=[];}};
  const tableRow=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(v=>v.trim());
  const isDivider=line=>/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const isList=line=>/^([-*+]\s+|\d+[.)]\s+)/.test(line);
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(inCode){
      if(/^\x60{3}/.test(line)){output+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';code=[];inCode=false;}
      else code.push(lines[i]);
      continue;
    }
    if(/^\x60{3}/.test(line)){flushParagraph();flushQuote();closeList();inCode=true;continue;}
    if(!line){
      flushParagraph();flushQuote();
      const upcoming=lines.slice(i+1).find(x=>x.trim())?.trim()||'';
      if(!list || !isList(upcoming) || (list==='ul')!==/^[-*+]\s+/.test(upcoming))closeList();
      continue;
    }
    const illustration=line.match(/^!\[([^\]]*)\]\((https:\/\/irina-learning-api\.cpateammail\.workers\.dev\/media\/assets\/[A-Za-z0-9-]+\.(?:png|jpe?g|webp|gif|php))\)$/i);
    if(illustration){
      flushParagraph();flushQuote();closeList();
      output+='<figure class="lesson-figure"><img loading="lazy" decoding="async" src="'+esc(illustration[2])+'" alt="'+esc(illustration[1]||'Иллюстрация к уроку')+'"></figure>';
      continue;
    }
    if(/^\|/.test(line) && i+1<lines.length && isDivider(lines[i+1])){
      flushParagraph();flushQuote();closeList();
      const headings=tableRow(line);
      output+='<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>'+headings.map(v=>'<th>'+markdownInline(v)+'</th>').join('')+'</tr></thead><tbody>';
      i++;
      while(i+1<lines.length&&/^\|/.test(lines[i+1].trim())&&!isDivider(lines[i+1])){
        const cells=tableRow(lines[++i]);
        output+='<tr>'+headings.map((v,k)=>'<td>'+markdownInline(cells[k]||'')+'</td>').join('')+'</tr>';
      }
      output+='</tbody></table></div>';
      continue;
    }
    const heading=line.match(/^(#{1,5})\s+(.+)$/);
    if(heading){
      flushParagraph();flushQuote();closeList();
      const level=Math.min(heading[1].length+1,4);
      output+='<h'+level+'>'+markdownInline(heading[2])+'</h'+level+'>';
      continue;
    }
    if(/^([-*_]\s*){3,}$/.test(line)){
      flushParagraph();flushQuote();closeList();output+='<hr>';continue;
    }
    const bullet=line.match(/^[-*+]\s+(.+)$/);
    const numbered=line.match(/^\d+[.)]\s+(.+)$/);
    if(bullet||numbered){
      flushParagraph();flushQuote();
      const kind=bullet?'ul':'ol';
      if(list!==kind){closeList();output+='<'+kind+'>';list=kind;}
      output+='<li>'+markdownInline((bullet||numbered)[1])+'</li>';
      continue;
    }
    if(line.startsWith('>')){
      flushParagraph();closeList();quote.push(line.replace(/^>\s*/,''));continue;
    }
    flushQuote();closeList();paragraph.push(line);
  }
  flushParagraph();flushQuote();closeList();
  if(inCode)output+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';
  return output;
}
async function showLesson(section,id){
  activeSection=section;
  app.innerHTML=header('Загружаем урок','Открываем материал…')+'<div class="status">Загружаем содержимое…</div>';
  try{
    const result=await api('lesson',{section,id});
    const lesson=result.lesson;
    const subtitle=section==='theory'?'Бесплатная теория':sectionById(section)?.title||'Практические инструкции';
    app.innerHTML=header(lesson.title,subtitle,['Урок','Пошаговая инструкция'])+'<article class="lesson-article"><div class="lesson-prose">'+renderMarkdown(lesson.body)+'</div></article><button class="button-outline back-to-catalog" id="lesson-back">← К списку материалов</button><footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';
    document.getElementById('lesson-back')?.addEventListener('click',goBack);
  }catch(error){
    if(error.status===401){
      const chosen=sectionById(section);
      app.innerHTML=header(chosen?.title||'Практические инструкции','Не удалось подтвердить Telegram-профиль.')+
        '<section class="purchase-panel"><h2>Откройте Irina из Telegram</h2><p>Если метка уже есть, покупать повторно не нужно. Откройте главную Irina через мини-приложение и вернитесь в урок.</p><a class="button-main" href="/">На главную →</a></section>';
    } else if(error.status===403){
      const chosen=sectionById(section);
      app.innerHTML=header(chosen?.title||'Практические инструкции','Для чтения этого урока нужен доступ к выбранному разделу.')+'<section class="purchase-panel"><h2>Материал доступен после покупки</h2><p>Стоимость всего раздела: '+esc(settings.practice_price_stars||'1200')+' ⭐. После подтверждённой покупки бот выдаст доступ. Если уже оплатили, вернитесь сюда из Telegram и проверьте его.</p><div class="product-footer">'+buyButton('Купить раздел')+'<button type="button" class="button-outline" id="check-learning-access">Проверить доступ</button></div></section>';
      document.getElementById('check-learning-access')?.addEventListener('click',()=>showLesson(section,id));
    }else failure(error.message==='learning_unavailable'?'Сервис материалов временно недоступен. Доступ к платным урокам не открывается без проверки покупки.':undefined);
  }
}
async function showTheory(){
  app.innerHTML=header('Теория арбитража трафика','Разберитесь в терминах, роли участников, основных цифрах и типичных ошибках.', ['Бесплатно','9 тем','Для новичков'])+'<div class="status">Загружаем темы…</div>';
  try{const r=await api('list',{section:'theory'});lessons=r.lessons||[];lessonMap=new Map(lessons.map(x=>[x.id,x]));app.innerHTML=header('Теория арбитража трафика','Начните с основ и двигайтесь по темам в удобном темпе. Все материалы доступны бесплатно.', ['Бесплатно',lessons.length+' тем','Для новичков'])+'<div class="list">'+lessons.map((l,i)=>'<a class="unit" href="'+esc(lessonHref('theory',l.id))+'"><span class="unit-icon">'+String(i+1).padStart(2,'0')+'</span><span class="unit-body"><span class="unit-title">'+esc(l.title)+'</span><span class="unit-note">Открыть материал</span></span><span class="unit-chevron">›</span></a>').join('')+'</div><footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';}catch{failure();}
}
async function showStore(){
  app.innerHTML=header('Практические инструкции','Выберите тему или заберите сразу четыре раздела. Каждая покупка открывает все материалы выбранной темы.', ['4 направления','Оплата в Telegram Stars'])+'<div class="status">Загружаем каталог…</div>';
  const [catalog,access]=await Promise.all([api('catalog').catch(()=>null),loadPurchases()]);
  if(catalog){lessons=catalog.lessons||lessons;settings={...settings,...catalog.settings};}
  const price=esc(settings.practice_price_stars||'1200');
  const html=sections.map(s=>{
    const count=lessons.filter(l=>l.section===s.id).length;
    const bought=access?.[s.id]===true;
    return '<article class="product'+(bought?' product-purchased':'')+'"><div class="product-top"><span class="product-icon">'+s.emoji+'</span><h2>'+esc(s.title)+'</h2></div><p>'+esc(s.description)+'</p><span class="product-meta">'+(count?count+' материалов в разделе':'Полный раздел с инструкциями')+'</span><div class="product-footer">'+(bought?'<span class="purchase-badge">✓ Куплен</span>':access?'<span class="stars">'+price+' ⭐</span>':'<span class="product-meta">Проверка покупки недоступна</span>')+'<a class="button-main" href="/practice?topic='+s.id+'">'+(bought?'Перейти':access?'Выбрать':'Открыть')+' →</a></div></article>';
  }).join('');
  const allBought=sections.every(s=>access?.[s.id]===true);
  const hasPurchases=sections.some(s=>access?.[s.id]===true);
  const bundle=access&&!allBought?'<section class="bundle"><span class="bundle-tag">Комплект выгоднее</span><h2>Все практические инструкции</h2><p>Четыре раздела: креативы, инфраструктура Facebook Ads, Keitaro и запуск рекламы. Полный набор в одном пакете.</p><div class="bundle-footer"><span class="stars">'+esc(settings.bundle_price_stars||'3600')+' ⭐</span>'+buyButton('Выбрать комплект')+'</div></section>':'';
  app.innerHTML=header('Практические инструкции',hasPurchases?'Купленные разделы уже доступны. Выберите тему и переходите к материалам.':'Выберите нужную тему. В стоимость входит весь раздел, а не отдельная статья.', ['4 направления',allBought?'Все разделы куплены':hasPurchases?'Есть купленные разделы':'Оплата в Telegram Stars'])+(access?'':purchaseCheckNotice())+'<div class="product-grid">'+html+'</div>'+bundle+'<footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';
  bindPurchaseRetry();
}
async function showSection(id){
  const s=sectionById(id);if(!s){location.replace('/practice');return;}
  activeSection=id;
  app.innerHTML=header(s.title,s.description)+'<div class="status">Загружаем материалы и проверяем доступ…</div>';
  try{
    const [r,access,catalog]=await Promise.all([api('list',{section:id}),loadPurchases(),api('catalog').catch(()=>null)]);
    lessons=r.lessons||[];lessonMap=new Map(lessons.map(x=>[x.id,x]));
    if(catalog)settings={...settings,...catalog.settings};
    const bought=access?.[id]===true;
    const badges=[lessons.length+' материалов'];
    if(bought)badges.push('✓ Куплен · Доступ открыт');
    else if(access)badges.push((settings.practice_price_stars||'1200')+' ⭐ за весь раздел');
    const purchasePanel=bought?'':access?'<section class="purchase-panel"><h2>Доступ ко всем материалам</h2><p>Стоимость раздела: '+esc(settings.practice_price_stars||'1200')+' ⭐. После покупки в боте доступ откроется сразу после подтверждения платежа.</p>'+buyButton('Перейти к покупке')+'</section>':purchaseCheckNotice();
    app.innerHTML=header(s.title,s.description,badges)+'<section class="section-panel"><h2>'+(bought?'Ваши материалы':'Что внутри')+'</h2>'+lessonButtons(id,lessons)+'</section>'+purchasePanel+'<footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';
    bindPurchaseRetry();
  }catch{failure();}
}
async function run(){
  const q=currentQuery();
  try{
    if(page==='theory'){
      if(q.get('lesson')){try{const x=await api('list',{section:'theory'});lessonMap=new Map((x.lessons||[]).map(v=>[v.id,v]));}catch{}await showLesson('theory',q.get('lesson'));}
      else await showTheory();
    }else{
      const section=q.get('topic');
      if(!section){await showStore();}
      else if(q.get('lesson')){try{const x=await api('list',{section});lessonMap=new Map((x.lessons||[]).map(v=>[v.id,v]));}catch{}await showLesson(section,q.get('lesson'));}
      else await showSection(section);
    }
  }catch{failure();}
}
run();
