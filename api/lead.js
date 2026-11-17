'use strict';
// Функция Vercel: проверяет заявку на сервере и отправляет её владельцу через Telegram-бота. Ничего не хранит.
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

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Проверка переменных окружения (токен бота и id чата задаются только в Vercel)
  const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const CHAT = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(TOKEN) || !/^-?\d{5,15}$/.test(CHAT)) {
    console.error('[env] TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы или заданы неверно');
    return res.status(500).json({ ok: false, error: 'Сервис временно недоступен. Позвоните нам.' });
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
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: молча отбрасываем

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

  const text = [
    'Новая заявка с сайта',
    `Телефон: ${phone}`,
    name && `Имя: ${name}`,
    `Район: ${district}`,
    `Человек в доме: ${people}`,
    `Наружная труба: ${pipeM} м`,
    comment && `Комментарий: ${comment}`,
  ].filter(Boolean).join('\n');

  // Отправка владельцу через бота (обычный текст, без разметки)
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
    });
    if (!r.ok) {
      console.error('[telegram] HTTP ' + r.status);
      return res.status(502).json({ ok: false, error: 'Не удалось отправить заявку. Позвоните нам или напишите в Telegram.' });
    }
  } catch (e) {
    console.error('[telegram] ' + (e && e.name));
    return res.status(502).json({ ok: false, error: 'Не удалось отправить заявку. Позвоните нам или напишите в Telegram.' });
  } finally { clearTimeout(timer); }
  return res.status(200).json({ ok: true });
};
