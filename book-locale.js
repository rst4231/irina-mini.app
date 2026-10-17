(() => {
  globalThis.BookLocale = Object.freeze({
    resolveLanguage(saved, device) {
      if (saved === 'ru' || saved === 'en') return saved;
      return /^en(?:[-_]|$)/i.test(device || '') ? 'en' : 'ru';
    },
    formatPrice(price, language) {
      return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
        style: 'currency', currency: language === 'en' ? 'USD' : 'RUB',
        minimumFractionDigits: language === 'en' ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(language === 'en' ? price.usd : price.rub);
    },
  });
})();
