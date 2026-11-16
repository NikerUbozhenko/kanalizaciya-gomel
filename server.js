'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { DatabaseSync } = require('node:sqlite'); // встроенная SQLite, Node 22.13+

/* ---------- 1. Проверка переменных окружения ---------- */
const fail = (m) => { console.error('[env] ' + m); process.exit(1); };
['SITE_URL', 'TELEGRAM_USERNAME', 'ALLOWED_ORIGINS'].forEach((k) => {
  if (!process.env[k] || !process.env[k].trim()) fail(`Не задана переменная ${k}`);
});
const SITE_URL = process.env.SITE_URL.trim().replace(/\/+$/, '');
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(SITE_URL)) fail('SITE_URL должен быть вида https://domain.by');
const TG = process.env.TELEGRAM_USERNAME.trim().replace(/^@/, '');
if (!/^[A-Za-z0-9_]{5,32}$/.test(TG)) fail('TELEGRAM_USERNAME задан неверно');
const ORIGINS = new Set(process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean));
ORIGINS.add(SITE_URL);
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) fail('PORT задан неверно');
const RETENTION = Math.min(Math.max(parseInt(process.env.LEADS_RETENTION_DAYS || '90', 10) || 90, 1), 3650);
const PROD = process.env.NODE_ENV === 'production';

/* ---------- 2. База (только параметризованные запросы) ---------- */
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, 'data', 'leads.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  name TEXT, phone TEXT NOT NULL, district TEXT NOT NULL,
  people INTEGER NOT NULL, pipe_m INTEGER NOT NULL, comment TEXT
)`);
const insertLead = db.prepare(
  'INSERT INTO leads (created_at, name, phone, district, people, pipe_m, comment) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const purge = db.prepare('DELETE FROM leads WHERE created_at < ?');
const runPurge = () => purge.run(Date.now() - RETENTION * 86400000);
runPurge();
setInterval(runPurge, 6 * 3600 * 1000).unref();

/* ---------- 3. Приложение ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // за nginx

if (PROD) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.redirect(301, SITE_URL + req.originalUrl);
  });
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      ...(PROD ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  hsts: PROD ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

/* Лимит запросов: 500 в минуту с одного IP */
app.use(rateLimit({ windowMs: 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false }));
/* Отдельный строгий лимит на отправку заявок */
const leadLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Слишком много попыток. Повторите через минуту.' },
});

/* CORS: только свои домены */
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ORIGINS.has(origin)),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
}));

/* ---------- 4. Страницы (шаблоны с подстановкой SITE_URL) ---------- */
const page = (file) => {
  const html = fs.readFileSync(path.join(__dirname, 'views', file), 'utf8').replace(/\{\{SITE_URL\}\}/g, SITE_URL);
  return (req, res) => res.type('html').set('Cache-Control', 'no-cache').send(html);
};
app.get('/', page('index.html'));
app.get('/privacy', page('privacy.html'));
app.get('/robots.txt', (req, res) =>
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const d = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc><lastmod>${d}</lastmod><priority>1.0</priority></url>
<url><loc>${SITE_URL}/privacy</loc><lastmod>${d}</lastmod><priority>0.3</priority></url>
</urlset>`);
});
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, dotfiles: 'ignore', maxAge: '30d', immutable: false,
}));

/* ---------- 5. API заявки: серверная валидация ---------- */
const DISTRICTS = ['Гомель', 'Речица', 'Добруш', 'Чечерск', 'Корма', 'Светлогорск', 'Ветка', 'Наровля', 'Петриков',
  'Хойники', 'Ельск', 'Довск', 'Брагин', 'Лельчицы', 'Рогачёв', 'Жлобин', 'Калинковичи', 'Лоев', 'Другой населённый пункт'];
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('80')) d = '375' + d.slice(2);
  return /^375(25|29|33|44)\d{7}$/.test(d) ? '+' + d : null;
}

app.post('/api/lead', leadLimiter, express.json({ limit: '10kb', strict: true, type: 'application/json' }), (req, res) => {
  const origin = req.get('Origin');
  if (origin && !ORIGINS.has(origin.replace(/\/+$/, ''))) return res.status(403).json({ ok: false, error: 'Запрещено' });
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ ok: false, error: 'Неверный запрос' });
  if (b.website) return res.status(200).json({ ok: true, tgUrl: `https://t.me/${TG}` }); // honeypot: молча отбрасываем

  const errors = {};
  const phone = normalizePhone(b.phone);
  if (!phone) errors.phone = 'Введите белорусский номер, например +375 44 123-45-67';
  const name = clean(b.name, 60);
  if (name && !/^[\p{L}\p{N} .'-]+$/u.test(name)) errors.name = 'Только буквы и цифры';
  const district = String(b.district ?? '');
  if (!DISTRICTS.includes(district)) errors.district = 'Выберите район из списка';
  const people = Number(b.people);
  if (!Number.isInteger(people) || people < 1 || people > 20) errors.people = 'От 1 до 20 человек';
  const pipeM = Number(b.pipeM);
  if (!Number.isInteger(pipeM) || pipeM < 0 || pipeM > 200) errors.pipeM = 'От 0 до 200 м';
  const comment = clean(b.comment, 500);
  if (b.consent !== true) errors.consent = 'Нужно согласие на обработку данных';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  insertLead.run(Date.now(), name || null, phone, district, people, pipeM, comment || null);

  const lines = [
    'Здравствуйте! Хочу рассчитать монтаж канализации.',
    `Район: ${district}`,
    `Человек в доме: ${people}`,
    `Наружная труба: ${pipeM} м`,
    name && `Имя: ${name}`,
    `Телефон: ${phone}`,
    comment && `Комментарий: ${comment}`,
  ].filter(Boolean);
  res.json({ ok: true, tgUrl: `https://t.me/${TG}?text=${encodeURIComponent(lines.join('\n'))}` });
});

/* ---------- 6. 404 и ошибки (без утечки деталей) ---------- */
app.use((req, res) => res.status(404).type('text/plain').send('Страница не найдена'));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Неверный JSON' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'Слишком большой запрос' });
  console.error(err);
  res.status(500).json({ ok: false, error: 'Ошибка сервера' });
});

app.listen(PORT, '127.0.0.1', () => console.log(`Сайт запущен: http://127.0.0.1:${PORT}`));
