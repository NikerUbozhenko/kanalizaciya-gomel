# Сайт: монтаж канализации, Гомель и область (Vercel)

Структура: `public/` (css, js, фото, шрифты), `views/` (страницы), `api/lead.js` (функция формы),
`build.js` (сборка), `vercel.json` (заголовки безопасности и кеш).

## Выложить на GitHub
1. На github.com/new создайте пустой репозиторий (без README), например `kanalizaciya-gomel`, лучше Private.
2. В папке проекта:
   git init
   git add .
   git commit -m "Сайт: монтаж канализации Гомель"
   git branch -M main
   git remote add origin https://github.com/ВАШ_ЛОГИН/kanalizaciya-gomel.git
   git push -u origin main

## Выложить на Vercel
1. vercel.com → Add New → Project → выберите репозиторий → Import.
2. Settings проекта: Framework Preset = Other (остальное берётся из vercel.json).
3. Откройте файл `api/_config.js` и впишите TELEGRAM_BOT_TOKEN (от @BotFather) и TELEGRAM_CHAT_ID (ваш числовой id).
   Репозиторий должен быть PRIVATE. Откройте своего бота и нажмите Start, иначе бот не сможет вам писать.
   Переменные в панели Vercel не нужны (если заданы, используются как запасной вариант).
4. Deploy. Адрес будет вида https://название.vercel.app

## Свой домен
Vercel → Project → Settings → Domains → Add. Пропишите DNS по подсказке Vercel, HTTPS включится сам.
После этого задайте SITE_URL=https://ваш-домен.by и сделайте Redeploy (для canonical и sitemap).

## Лимит запросов
Функция формы ограничивает частоту сама (10 в минуту на IP, в памяти экземпляра). Общий лимит
500 в минуту настройте в Vercel: Project → Firewall → Add Rule → Rate Limit.

## Цены в квизе
Все цены и коэффициенты лежат в `public/js/prices.js`. Из объявления взяты только «от 1400 руб.» и 30 руб. за метр трубы,
остальные надбавки там ЗАГЛУШКИ: до запуска замените их реальными ценами владельца.

## Карта
Контур Гомельской области встроен в `views/index.html` как SVG (данные Natural Earth, общественное достояние).

## Лицензии
Шрифты Manrope и Oswald: SIL OFL 1.1 (public/fonts/OFL-Manrope.txt, OFL-oswald.txt), использование на сайтах разрешено.
