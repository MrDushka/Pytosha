// Настройки мини-приложения.
// API_URL — серверная функция в Supabase. Вне Telegram (просто в браузере) приложение работает в демо-режиме.
window.PITOSHA_CONFIG = {
  API_URL: (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)
    ? 'https://bebjhpmknpcwwinhurtp.supabase.co/functions/v1/pitosha'
    : '',
};
