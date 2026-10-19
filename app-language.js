(() => {
  const english = {
    'Ирина':'Irina', 'Привет, {name}!':'Hi, {name}!', 'Пользователь':'User',
    'Загрузка приложения':'Loading the app', 'Открыть в Telegram':'Open in Telegram',
    'Откройте страницу в боте @rstshelp_bot':'Open this page in @rstshelp_bot',
    'Эта страница работает внутри Telegram Mini App.':'This page runs inside a Telegram Mini App.',
    'Открыть бота':'Open bot', 'Профиль пользователя':'User profile', 'Статус анкеты':'Application status',
    'Проверяем анкету...':'Checking your application…', 'Загружаем актуальный статус':'Loading your current status',
    'Анкета не заполнена':'Application not completed',
    'Заполните короткую анкету и обсудите условия':'Complete a short application and discuss the details',
    'Заполнить анкету':'Complete application', 'Займет пару минут':'Takes a couple of minutes',
    'Анкета заполнена':'Application submitted',
    'Анкета отправлена. Ожидайте результат проверки':'Your application has been submitted. Please wait for the review.',
    'Анкета одобрена':'Application approved',
    'Анкета одобрена. Обсудите условия участия':'Your application is approved. Discuss the participation details.',
    'Обсудить условия':'Discuss the details', 'Займет 10–15 минут':'Takes 10–15 minutes',
    'Условия готовы':'Your participation details are ready',
    'Условия готовы. Посмотрите детали участия':'Your participation details are ready. Take a look.',
    'Посмотреть условия':'View the details', 'Анкета не одобрена':'Application declined',
    'К сожалению, ваша анкета не прошла отбор':'Unfortunately, your application was not selected.',
    'Показываем последние данные. Обновим автоматически.':'Showing the latest saved data. We will update it automatically.',
    'Обновлено только что':'Updated just now', 'Обновлено {n} мин назад':'Updated {n} min ago',
    'Данные от {time}':'Data from {time}', 'Не удалось обновить данные':'Could not refresh the data',
    'Повторить':'Retry', 'Проверяем изменения...':'Checking for changes…',
    'Не удалось проверить анкету':'Could not check your application',
    'Попробуйте открыть приложение ещё раз':'Try opening the app again',
    'Полезные ссылки':'Useful links', 'Сейчас идет набор':'Applications are open',
    'Подробнее о наборе':'Join the program',
    'Набор в команду':'Join Our Team',
    'Магазин аккаунтов':'Account Store',
    'Аккаунты для рекламы':'Advertising Accounts',
    'Научитесь лить и станьте частью сильного сообщества':'Learn to run campaigns and join a strong community',
    'О команде, кейсы, отзывы':'Team, case studies and reviews',
    'Отзыв о работе с нами':'Reviews of working with us',
    'Реальные результаты и отзывы':'Real results and reviews',
    'Теория':'Theory',
    'Основы арбитража трафика бесплатно':'Learn affiliate marketing basics for free',
    'Практические инструкции':'Practical Guides',
    'Креативы, инфраструктура, Keitaro и запуск':'Creatives, setup, Keitaro and launches',
    'Руководства по арбитражу трафика':'Affiliate Marketing Guides',
    'Две книги для прибыльных запусков':'Two books for profitable campaigns',
    'Перейти к наставнику':'Open your mentor',
    'Продолжить практику с наставником':'Continue practicing with your mentor',
    'Нам доверяют и о нас говорят':'Trusted by the community',
    'Нам доверяют и о нас говорят: Keitaro, Conversion, Партнеркин, M1.TOP, NUTRA.CLUB':'Trusted by the community: Keitaro, Conversion, Partnerkin, M1.TOP, NUTRA.CLUB',
    'Telegram-канал':'Telegram channel',
  };
  let saved = '';
  try {saved=localStorage.getItem('irina_language') || localStorage.getItem('irina_book_language');} catch {}
  let language=window.BookLocale.resolveLanguage(saved,navigator.language || navigator.languages?.[0]);
  function t(text,values={}) {
    let result=language==='en' ? (english[text] || text) : text;
    for (const [key,value] of Object.entries(values)) result=result.replaceAll('{'+key+'}',value);
    return result;
  }
  const textNodes=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
    const node=walker.currentNode;
    if(!node.parentElement.closest('script,style,svg,#profile-name') && english[node.textContent.trim()]) textNodes.push([node,node.textContent]);
  }
  const attributes=[];
  document.querySelectorAll('[aria-label]').forEach(node=>{
    const original=node.getAttribute('aria-label');
    if(english[original]) attributes.push([node,original]);
  });
  function apply() {
    document.documentElement.lang=language;
    document.title=t('Ирина');
    for(const [node,original] of textNodes) if(node.isConnected) node.textContent=original.replace(original.trim(),t(original.trim()));
    for(const [node,original] of attributes) node.setAttribute('aria-label',t(original));
    document.querySelectorAll('[data-app-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appLanguage===language)));
  }
  window.AppLanguage={t,get language(){return language;}};
  document.querySelectorAll('[data-app-language]').forEach(button=>button.addEventListener('click',()=>{
    language=button.dataset.appLanguage;
    try {localStorage.setItem('irina_language',language);} catch {}
    apply();
    window.dispatchEvent(new Event('irinalanguagechange'));
  }));
  function syncPreference() {
    let next = '';
    try {next=localStorage.getItem('irina_language');} catch {return;}
    if (!['ru','en'].includes(next) || next === language) return;
    language=next;
    apply();
    window.dispatchEvent(new Event('irinalanguagechange'));
  }
  window.addEventListener('pageshow',syncPreference);
  window.addEventListener('storage',syncPreference);
  apply();
})();
