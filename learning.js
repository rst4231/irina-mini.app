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
async function api(mode, params={}){
  const res = await fetch('/api/learning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,...params,initData:telegramInitData()}),cache:'no-store'});
  const data = await res.json().catch(()=>({error:'bad_response'}));
  if(!res.ok){const e=new Error(data.error||'request_failed');e.status=res.status;throw e;}
  return data;
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
    return '<a href="'+esc(href)+'"'+(internal?'':' target="_blank" rel="noopener noreferrer"')+'>'+label+'</a>';
  });
  content=content.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
  content=content.replace(/`([^`]+)`/g,'<code>$1</code>');
  return content;
}
function renderMarkdown(source){
  const cleaned=String(source||'').replace(/<summary>/gi,'\n### ').replace(/<\/summary>/gi,'\n').replace(/<\/?details[^>]*>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/\r\n?/g,'\n');
  const lines=cleaned.split('\n');let out='';let list=null;let paragraph=[];
  const flush=()=>{if(paragraph.length){out+='<p>'+markdownInline(paragraph.join(' '))+'</p>';paragraph=[];}};
  const close=()=>{if(list){out+='</'+list+'>';list=null;}};
  for(const raw of lines){const line=raw.trim();
    if(!line){flush();close();continue;}
    const heading=line.match(/^(#{1,5})\s+(.+)$/);
    if(heading){flush();close();const size=Math.min(heading[1].length+1,4);out+='<h'+size+'>'+markdownInline(heading[2])+'</h'+size+'>';continue;}
    if(/^(-{3,}|\*{3,})$/.test(line)){flush();close();out+='<hr>';continue;}
    const bullet=line.match(/^[-*+]\s+(.+)$/);const number=line.match(/^\d+[.)]\s+(.+)$/);
    if(bullet||number){flush();const type=bullet?'ul':'ol';if(list!==type){close();out+='<'+type+'>';list=type;}out+='<li>'+markdownInline((bullet||number)[1])+'</li>';continue;}
    if(line.startsWith('>')){flush();close();out+='<blockquote>'+markdownInline(line.replace(/^>\s*/,''))+'</blockquote>';continue;}
    close();paragraph.push(line);
  }
  flush();close();return out;
}
async function showLesson(section,id){
  activeSection=section;
  if(section!=='theory' && !telegramInitData()){
    const selected=sectionById(section);
    app.innerHTML=header(selected?.title||'Практические инструкции','Для проверки метки нужен вход через Telegram.')+
      '<section class="purchase-panel"><h2>Войдите через Telegram</h2><p>Метка SendPulse проверяется автоматически, но для этого откройте Irina через Telegram Mini App. Повторно покупать ничего не нужно.</p><a class="button-main" href="https://t.me/rstshelp_bot" target="_blank" rel="noopener noreferrer">Открыть бота ↗</a></section>';
    return;
  }
  app.innerHTML=header('Загружаем урок','Открываем материал…')+'<div class="status">Загружаем содержимое…</div>';
  try{
    const result=await api('lesson',{section,id});
    const lesson=result.lesson;
    const subtitle=section==='theory'?'Бесплатная теория':sectionById(section)?.title||'Практические инструкции';
    app.innerHTML=header(lesson.title,subtitle,['Урок','Пошаговая инструкция'])+'<article class="lesson-article"><div class="lesson-prose">'+renderMarkdown(lesson.body)+'</div></article><button class="button-outline back-to-catalog" id="lesson-back">← К списку материалов</button><footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';
    document.getElementById('lesson-back')?.addEventListener('click',goBack);
  }catch(error){
    if(error.status===403){
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
  try{const r=await api('catalog');lessons=r.lessons||lessons;settings={...settings,...r.settings};}catch{/* Keep the catalog accessible during a temporary content outage. */ }
  const price=esc(settings.practice_price_stars||'1200');
  const html=sections.map(s=>{
    const count=lessons.filter(l=>l.section===s.id).length;
    return '<article class="product"><div class="product-top"><span class="product-icon">'+s.emoji+'</span><h2>'+esc(s.title)+'</h2></div><p>'+esc(s.description)+'</p><span class="product-meta">'+(count?count+' материалов в разделе':'Полный раздел с инструкциями')+'</span><div class="product-footer"><span class="stars">'+price+' ⭐</span><a class="button-main" href="/practice?topic='+s.id+'">Выбрать →</a></div></article>';
  }).join('');
  app.innerHTML=header('Практические инструкции','Выберите нужную тему. В стоимость входит весь раздел, а не отдельная статья.', ['4 направления','Оплата в Telegram Stars'])+'<div class="product-grid">'+html+'</div><section class="bundle"><span class="bundle-tag">Комплект выгоднее</span><h2>Все практические инструкции</h2><p>Четыре раздела: креативы, инфраструктура Facebook Ads, Keitaro и запуск рекламы. Полный набор в одном пакете.</p><div class="bundle-footer"><span class="stars">'+esc(settings.bundle_price_stars||'3600')+' ⭐</span>'+buyButton('Выбрать комплект')+'</div></section><footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';
}
async function showSection(id){
  const s=sectionById(id);if(!s){location.replace('/practice');return;}
  activeSection=id;
  app.innerHTML=header(s.title,s.description,[settings.practice_price_stars+' ⭐ за раздел'])+'<div class="status">Загружаем список материалов…</div>';
  try{
    const r=await api('list',{section:id});lessons=r.lessons||[];lessonMap=new Map(lessons.map(x=>[x.id,x]));
    try{const c=await api('catalog');settings={...settings,...c.settings};}catch{}
    app.innerHTML=header(s.title,s.description,[lessons.length+' материалов',esc(settings.practice_price_stars||'1200')+' ⭐ за весь раздел'])+'<section class="section-panel"><h2>Что внутри</h2>'+lessonButtons(id,lessons)+'</section><section class="purchase-panel"><h2>Доступ ко всем материалам</h2><p>Стоимость раздела: '+esc(settings.practice_price_stars||'1200')+' ⭐. После покупки в боте доступ откроется сразу после подтверждения платежа.</p>'+buyButton('Перейти к покупке')+'</section><footer class="foot">© 2018–'+new Date().getFullYear()+'</footer>';
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
      if(!section){try{const x=await api('catalog');lessons=x.lessons||[];settings={...settings,...x.settings};}catch{}await showStore();}
      else if(q.get('lesson')){try{const x=await api('list',{section});lessonMap=new Map((x.lessons||[]).map(v=>[v.id,v]));}catch{}await showLesson(section,q.get('lesson'));}
      else await showSection(section);
    }
  }catch{failure();}
}
run();
