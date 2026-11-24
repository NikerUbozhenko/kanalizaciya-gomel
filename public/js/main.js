'use strict';
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var P = window.PRICES;
  var DISTRICTS = ['Гомель', 'Речица', 'Добруш', 'Чечерск', 'Корма', 'Светлогорск', 'Ветка', 'Наровля', 'Петриков',
    'Хойники', 'Ельск', 'Довск', 'Брагин', 'Лельчицы', 'Рогачёв', 'Жлобин', 'Калинковичи', 'Лоев', 'Другой населённый пункт'];
  var fmt = function (n) { return n.toLocaleString('ru-RU'); };
  var round10 = function (n) { return Math.round(n / 10) * 10; };

  /* создание элементов без innerHTML */
  function el(tag, props, text) {
    var e = document.createElement(tag), k;
    for (k in (props || {})) { if (k === 'class') e.className = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }

  $('#year').textContent = new Date().getFullYear();

  /* меню на телефоне */
  var burger = $('#burger'), nav = $('#nav');
  function closeNav() { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', function () { burger.setAttribute('aria-expanded', String(nav.classList.toggle('open'))); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeNav(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { closeNav(); burger.focus(); } });

  /* ---------- квиз: 5 вопросов + контакты ---------- */
  var STEPS = [
    { key: 'people', q: 'Сколько человек живёт в доме?', opts: P.people },
    { key: 'soil', q: 'Какой грунт на участке?', opts: P.soil, hint: 'Не уверены? Выберите «Не знаю», мастер уточнит на выезде.' },
    { key: 'pipe', q: 'Какое расстояние от дома до септика?', opts: P.pipe },
    { key: 'access', q: 'Сможет ли подъехать техника?', opts: P.access },
    { key: 'wiring', q: 'Нужна ли внутренняя разводка?', opts: P.wiring }
  ];
  var VIA = ['Звонок', 'Telegram', 'WhatsApp', 'Viber'];
  var TOTAL = STEPS.length + 1;
  var box = $('#quiz'), step = 0, ans = {};
  var form = { name: '', phone: '', district: DISTRICTS[0], via: VIA[0], comment: '', consent: false };

  function clear() { while (box.firstChild) box.removeChild(box.firstChild); }
  function focusTitle() { var t = box.querySelector('[data-focus]'); if (t) t.focus({ preventScroll: true }); }

  function header(n, total) {
    var h = el('div', { class: 'q-head' });
    h.appendChild(el('p', { class: 'q-count' }, 'Шаг ' + n + ' из ' + total));
    var track = el('div', { class: 'q-track', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total), 'aria-valuenow': String(n), 'aria-label': 'Прогресс' });
    var fill = el('div', { class: 'q-fill' }); fill.style.setProperty('--p', Math.round(n / total * 100) + '%');
    track.appendChild(fill); h.appendChild(track);
    return h;
  }

  function renderStep() {
    if (step >= STEPS.length) { renderContact(); return; }
    var s = STEPS[step]; clear();
    box.appendChild(header(step + 1, TOTAL));
    var fs = el('fieldset', { class: 'q' });
    fs.appendChild(el('legend', { tabindex: '-1', 'data-focus': '1' }, s.q));
    if (s.hint) fs.appendChild(el('p', { class: 'muted q-hint' }, s.hint));
    var next = el('button', { type: 'button', class: 'btn' }, 'Дальше');
    s.opts.forEach(function (o, i) {
      var id = 'q-' + s.key + '-' + i;
      var lab = el('label', { class: 'opt', 'for': id });
      var inp = el('input', { type: 'radio', name: s.key, id: id, value: String(i) });
      if (ans[s.key] === i) inp.checked = true;
      inp.addEventListener('change', function () { ans[s.key] = i; next.disabled = false; });
      lab.appendChild(inp); lab.appendChild(el('span', null, o.label)); fs.appendChild(lab);
    });
    next.disabled = ans[s.key] == null;
    box.appendChild(fs);
    var row = el('div', { class: 'q-nav' });
    if (step > 0) {
      var back = el('button', { type: 'button', class: 'btn btn-line' }, 'Назад');
      back.addEventListener('click', function () { step--; renderStep(); focusTitle(); });
      row.appendChild(back);
    }
    next.addEventListener('click', function () { step++; renderStep(); focusTitle(); });
    row.appendChild(next); box.appendChild(row);
  }

  function calc() {
    var pe = P.people[ans.people], so = P.soil[ans.soil], pi = P.pipe[ans.pipe], ac = P.access[ans.access], wi = P.wiring[ans.wiring];
    var septic = round10((P.base + pe.add) * so.k), pipe = pi.m * P.pipePerM;
    var total = septic + pipe + ac.add + wi.add;
    return { pe: pe, so: so, pi: pi, ac: ac, wi: wi, septic: septic, pipe: pipe, from: round10(total), to: round10(total * (1 + P.rangeUp)) };
  }

  /* маска телефона: +375 29 123-45-67 */
  function phoneRest(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.indexOf('375') === 0) d = d.slice(3); else if (d.indexOf('80') === 0 && d.length > 2) d = d.slice(2);
    return d.slice(0, 9);
  }
  function buildPhone(r) {
    if (!r) return '';
    var o = '+375 ' + r.slice(0, 2);
    if (r.length > 2) o += ' ' + r.slice(2, 5);
    if (r.length > 5) o += '-' + r.slice(5, 7);
    if (r.length > 7) o += '-' + r.slice(7, 9);
    return o;
  }
  function phoneOk(v) { return /^375(25|29|33|44)\d{7}$/.test('375' + phoneRest(v)); }

  function row(id, label, ctrl) {
    var w = el('div', { class: 'f' });
    w.appendChild(el('label', { 'for': id }, label)); w.appendChild(ctrl);
    w.appendChild(el('small', { class: 'err', id: 'err-' + id, role: 'alert' }));
    return w;
  }

  function renderContact() {
    clear(); box.appendChild(header(TOTAL, TOTAL));
    box.appendChild(el('h3', { class: 'q-title', tabindex: '-1', 'data-focus': '1' }, 'Куда прислать расчёт?'));
    var f = el('form', { class: 'c-form', novalidate: 'novalidate' });
    var name = el('input', { id: 'name', type: 'text', maxlength: '60', autocomplete: 'given-name', placeholder: 'Как к вам обращаться', 'aria-describedby': 'err-name' });
    var phone = el('input', { id: 'phone', type: 'tel', autocomplete: 'tel', placeholder: '+375 __ ___-__-__', required: 'required', 'aria-describedby': 'err-phone' });
    var dist = el('select', { id: 'district' }); DISTRICTS.forEach(function (d) { dist.appendChild(el('option', { value: d }, d)); });
    var via = el('select', { id: 'via' }); VIA.forEach(function (v) { via.appendChild(el('option', { value: v }, v)); });
    var com = el('textarea', { id: 'comment', rows: '3', maxlength: '250', placeholder: 'Например, адрес или удобное время' });
    name.value = form.name; phone.value = form.phone; dist.value = form.district; via.value = form.via; com.value = form.comment;
    f.appendChild(row('name', 'Имя', name)); f.appendChild(row('phone', 'Телефон', phone));
    f.appendChild(row('district', 'Район', dist)); f.appendChild(row('via', 'Как с вами связаться', via));
    f.appendChild(row('comment', 'Комментарий (необязательно)', com));
    var hp = el('div', { class: 'f hp', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { 'for': 'website' }, 'Не заполняйте'));
    hp.appendChild(el('input', { id: 'website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' }));
    f.appendChild(hp);
    var ck = el('div', { class: 'f check' });
    var consent = el('input', { type: 'checkbox', id: 'consent', required: 'required', 'aria-describedby': 'err-consent' }); consent.checked = form.consent;
    ck.appendChild(consent);
    var cl = el('label', { 'for': 'consent' }, 'Согласен на обработку персональных данных (');
    cl.appendChild(el('a', { href: '/privacy', target: '_blank', rel: 'noopener' }, 'политика конфиденциальности')); cl.appendChild(document.createTextNode(')'));
    ck.appendChild(cl); ck.appendChild(el('small', { class: 'err', id: 'err-consent', role: 'alert' }));
    f.appendChild(ck);
    var back = el('button', { type: 'button', class: 'btn btn-line' }, 'Назад');
    var send = el('button', { type: 'submit', class: 'btn' }, 'Получить расчёт'); send.disabled = true;
    var nav = el('div', { class: 'q-nav' }); nav.appendChild(back); nav.appendChild(send); f.appendChild(nav);
    var status = el('p', { class: 'status', role: 'status' }); f.appendChild(status);
    box.appendChild(f);

    function toggle() { send.disabled = !(phoneOk(phone.value) && consent.checked); }
    toggle();
    name.addEventListener('input', function () { form.name = name.value; });
    dist.addEventListener('change', function () { form.district = dist.value; });
    via.addEventListener('change', function () { form.via = via.value; });
    com.addEventListener('input', function () { form.comment = com.value; });
    consent.addEventListener('change', function () { form.consent = consent.checked; toggle(); });
    var prev = phone.value;
    phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+375 '; });
    phone.addEventListener('blur', function () { if (phoneRest(phone.value) === '') { phone.value = ''; form.phone = ''; prev = ''; toggle(); } });
    phone.addEventListener('input', function (e) {
      var rest = phoneRest(phone.value), v = buildPhone(rest);
      if (e && e.inputType && e.inputType.indexOf('delete') === 0 && v.length >= prev.length && rest) { rest = rest.slice(0, -1); v = buildPhone(rest); }
      phone.value = v; prev = v; form.phone = v; toggle();
    });
    back.addEventListener('click', function () { step = STEPS.length - 1; renderStep(); focusTitle(); });

    f.addEventListener('submit', function (ev) {
      ev.preventDefault(); status.className = 'status'; status.textContent = '';
      var errs = {};
      if (!phoneOk(phone.value)) errs.phone = 'Введите белорусский номер, например +375 44 123-45-67';
      if (!consent.checked) errs.consent = 'Нужно согласие на обработку данных';
      showErrors(errs); if (Object.keys(errs).length) return;
      var r = calc();
      var comment = 'Связь: ' + form.via + '. Грунт: ' + r.so.label + '. Подъезд: ' + r.ac.label + '. Разводка: ' + r.wi.label +
        '. Расчёт на сайте: от ' + fmt(r.from) + ' до ' + fmt(r.to) + ' руб.' + (form.comment.trim() ? ' Комментарий: ' + form.comment.trim() : '');
      send.disabled = true; status.textContent = 'Отправляем…';
      fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ people: r.pe.people, pipeM: r.pi.m, district: form.district, name: form.name, phone: form.phone, comment: comment, website: $('#website').value, consent: consent.checked })
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.ok) { renderDone(r); }
          else { showErrors(res.j.errors || {}); status.className = 'status bad'; status.textContent = res.j.error || 'Проверьте поля формы.'; toggle(); }
        })
        .catch(function () { status.className = 'status bad'; status.textContent = 'Нет связи с сервером. Позвоните нам или напишите в Telegram: @zamvec'; toggle(); });
    });
  }

  function renderDone(r) {
    clear();
    box.appendChild(el('h3', { class: 'r-title', tabindex: '-1', 'data-focus': '1' }, 'Ориентировочная стоимость'));
    box.appendChild(el('p', { class: 'r-price' }, 'от ' + fmt(r.from) + ' до ' + fmt(r.to) + ' руб.'));
    var ul = el('ul', { class: 'r-list' });
    ul.appendChild(el('li', null, 'Септик и монтаж: ' + fmt(r.septic) + ' руб.'));
    if (r.pipe) ul.appendChild(el('li', null, 'Наружная труба: ' + r.pi.m + ' м × ' + P.pipePerM + ' руб. = ' + fmt(r.pipe) + ' руб.'));
    if (r.ac.add) ul.appendChild(el('li', null, 'Сложный подъезд: +' + fmt(r.ac.add) + ' руб.'));
    if (r.wi.add) ul.appendChild(el('li', null, 'Внутренняя разводка: +' + fmt(r.wi.add) + ' руб.'));
    box.appendChild(ul);
    box.appendChild(el('p', { class: 'muted' }, 'Это ориентир, а не окончательная цена. Точную смету назовёт мастер после выезда специалиста (выезд и смета — 100 руб.).'));
    box.appendChild(el('p', { class: 'done' }, 'Заявка отправлена. Мастер свяжется с вами: ' + form.via + ', ' + form.phone + '.'));
    var again = el('button', { type: 'button', class: 'btn btn-line' }, 'Рассчитать ещё раз');
    again.addEventListener('click', function () { step = 0; ans = {}; form = { name: '', phone: '', district: DISTRICTS[0], via: VIA[0], comment: '', consent: false }; renderStep(); focusTitle(); });
    box.appendChild(again); focusTitle();
  }
  function showErrors(errs) {
    ['phone', 'name', 'consent'].forEach(function (f) {
      var inp = $('#' + f), out = $('#err-' + f); if (!inp || !out) return;
      out.textContent = errs[f] || ''; if (errs[f]) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    });
    var first = ['phone', 'name', 'consent'].filter(function (f) { return errs[f]; })[0]; if (first) $('#' + first).focus();
  }
  renderStep();

  /* ---------- FAQ: открыт один пункт, остальные закрываются ---------- */
  var items = [].slice.call(document.querySelectorAll('.faq-item'));
  function setOpen(it, open) { it.classList.toggle('open', open); it.querySelector('.faq-q').setAttribute('aria-expanded', String(open)); }
  items.forEach(function (it) {
    it.querySelector('.faq-q').addEventListener('click', function () {
      var wasOpen = it.classList.contains('open');
      items.forEach(function (o) { setOpen(o, false); });
      if (!wasOpen) setOpen(it, true);
    });
  });
  var faqList = $('#faq-list');
  if (faqList) faqList.addEventListener('keydown', function (e) {
    var qs = items.map(function (it) { return it.querySelector('.faq-q'); }), i = qs.indexOf(document.activeElement), n = qs.length;
    if (i < 0) return;
    var to = e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to >= 0) { e.preventDefault(); qs[to].focus(); }
  });
  if (items.length) setOpen(items[0], true);

  /* ---------- cookie ---------- */
  var cb = $('#cookie');
  function getCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? m[1] : null; }
  function setCookie(v) { document.cookie = 'cookie_consent=' + v + '; max-age=31536000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); }
  if (!getCookie('cookie_consent')) cb.hidden = false;
  cb.addEventListener('click', function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) { setCookie(c); cb.hidden = true; } });
  $('#cookie-open').addEventListener('click', function () { cb.hidden = false; cb.querySelector('button').focus(); });
})();
