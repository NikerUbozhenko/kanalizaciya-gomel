'use strict';
// Функция Vercel: проверяет заявку на сервере и возвращает ссылку в Telegram. Ничего не хранит.
const DISTRICTS = ['Гомель', 'Речица', 'Добруш', 'Чечерск', 'Корма', 'Светлогорск', 'Ветка', 'Наровля', 'Петриков',
  'Хойники', 'Ельск', 'Довск', 'Брагин', 'Лельчицы', 'Рогачёв', 'Жлобин', 'Калинковичи', 'Лоев', 'Другой населённый пункт'];

// Ограничение частоты (в памяти экземпляра, ориентир). Основной лимит: Vercel Firewall, см. README.
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return list.length > max;
}
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('80')) d = '375' + d.slice(2);
  return /^375(25|29|33|44)\d{7}$/.test(d) ? '+' + d : null;
}
function originAllowed(origin, host) {
  try {
    const o = new URL(origin);
    if (o.host === host) return true; // свой домен (прод, превью, кастомный)
    const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
    return extra.includes(o.origin);
  } catch { return false; }
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Проверка переменных окружения
  const TG = (process.env.TELEGRAM_USERNAME || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{5,32}$/.test(TG)) {
    console.error('[env] TELEGRAM_USERNAME не задан или задан неверно');
    return res.status(500).json({ ok: false, error: 'Сервис временно недоступен. Напишите нам в Telegram.' });
  }

  // CORS: ответ с заголовками только для разрешённых источников
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin) {
    if (!originAllowed(origin, host)) return res.status(403).json({ ok: false, error: 'Запрещено' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    return res.status(204).end();
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).json({ ok: false, error: 'Метод не поддерживается' }); }
  if (!/^application\/json/i.test(req.headers['content-type'] || '')) return res.status(415).json({ ok: false, error: 'Нужен JSON' });
  if (Number(req.headers['content-length'] || 0) > 10000) return res.status(413).json({ ok: false, error: 'Слишком большой запрос' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip, 10, 60000)) return res.status(429).json({ ok: false, error: 'Слишком много попыток. Повторите через минуту.' });

  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ ok: false, error: 'Неверный запрос' });
  if (b.website) return res.status(200).json({ ok: true, tgUrl: `https://t.me/${TG}` }); // honeypot

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

  const lines = [
    'Здравствуйте! Хочу рассчитать монтаж канализации.',
    `Район: ${district}`,
    `Человек в доме: ${people}`,
    `Наружная труба: ${pipeM} м`,
    name && `Имя: ${name}`,
    `Телефон: ${phone}`,
    comment && `Комментарий: ${comment}`,
  ].filter(Boolean);
  return res.status(200).json({ ok: true, tgUrl: `https://t.me/${TG}?text=${encodeURIComponent(lines.join('\n'))}` });
};
