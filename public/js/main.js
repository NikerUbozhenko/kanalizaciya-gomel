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

  /* ---------- квиз ---------- */
  var STEPS = [
    { key: 'people', q: 'Сколько человек живёт в доме?', opts: P.people },
    { key: 'soil', q: 'Какой грунт на участке?', opts: P.soil, hint: 'Не уверены? Выберите «Не знаю», мастер уточнит на выезде.' },
    { key: 'pipe', q: 'Какое расстояние от дома до септика?', opts: P.pipe },
    { key: 'access', q: 'Сможет ли подъехать техника?', opts: P.access },
    { key: 'wiring', q: 'Нужна ли внутренняя разводка?', opts: P.wiring },
    { key: 'district', q: 'Где находится участок?', select: true }
  ];
  var box = $('#quiz'), step = 0, ans = {};

  function clear() { while (box.firstChild) box.removeChild(box.firstChild); }
  function focusTitle() { var t = box.querySelector('[data-focus]'); if (t) t.focus({ preventScroll: true }); }

  function header(n, total) {
    var h = el('div', { class: 'q-head' });
    h.appendChild(el('p', { class: 'q-count' }, 'Вопрос ' + n + ' из ' + total));
    var track = el('div', { class: 'q-track', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total), 'aria-valuenow': String(n), 'aria-label': 'Прогресс' });
    var fill = el('div', { class: 'q-fill' }); fill.style.setProperty('--p', Math.round(n / total * 100) + '%');
    track.appendChild(fill); h.appendChild(track);
    return h;
  }

  function renderStep() {
    var s = STEPS[step]; clear();
    box.appendChild(header(step + 1, STEPS.length));
    var fs = el('fieldset', { class: 'q' });
    fs.appendChild(el('legend', { tabindex: '-1', 'data-focus': '1' }, s.q));
    if (s.hint) fs.appendChild(el('p', { class: 'muted q-hint' }, s.hint));
    var next = el('button', { type: 'button', class: 'btn' }, step === STEPS.length - 1 ? 'Показать стоимость' : 'Дальше');

    if (s.select) {
      var sel = el('select', { id: 'q-district', 'aria-label': 'Район' });
      DISTRICTS.forEach(function (d) { var o = el('option', { value: d }, d); sel.appendChild(o); });
      if (ans.district != null) sel.value = ans.district;
      ans.district = sel.value;
      sel.addEventListener('change', function () { ans.district = sel.value; });
      fs.appendChild(sel);
    } else {
      s.opts.forEach(function (o, i) {
        var id = 'q-' + s.key + '-' + i;
        var lab = el('label', { class: 'opt', 'for': id });
        var inp = el('input', { type: 'radio', name: s.key, id: id, value: String(i) });
        if (ans[s.key] === i) inp.checked = true;
        inp.addEventListener('change', function () { ans[s.key] = i; next.disabled = false; });
        lab.appendChild(inp); lab.appendChild(el('span', null, o.label)); fs.appendChild(lab);
      });
      next.disabled = ans[s.key] == null;
    }
    box.appendChild(fs);

    var row = el('div', { class: 'q-nav' });
    if (step > 0) {
      var back = el('button', { type: 'button', class: 'btn btn-line' }, 'Назад');
      back.addEventListener('click', function () { step--; renderStep(); focusTitle(); });
      row.appendChild(back);
    }
    next.addEventListener('click', function () { if (step < STEPS.length - 1) { step++; renderStep(); } else { renderResult(); } focusTitle(); });
    row.appendChild(next); box.appendChild(row);
  }

  function calc() {
    var pe = P.people[ans.people], so = P.soil[ans.soil], pi = P.pipe[ans.pipe], ac = P.access[ans.access], wi = P.wiring[ans.wiring];
    var septic = round10((P.base + pe.add) * so.k), pipe = pi.m * P.pipePerM;
    var total = septic + pipe + ac.add + wi.add;
    return { pe: pe, so: so, pi: pi, ac: ac, wi: wi, septic: septic, pipe: pipe, from: round10(total), to: round10(total * (1 + P.rangeUp)) };
  }

  function field(id, label, attrs) {
    var w = el('div', { class: 'f' });
    w.appendChild(el('label', { 'for': id }, label));
    var inp = el('input', attrs); inp.id = id; w.appendChild(inp);
    w.appendChild(el('small', { class: 'err', id: 'err-' + id, role: 'alert' }));
    return w;
  }

  function renderResult() {
    var r = calc(); clear();
    box.appendChild(el('h3', { class: 'r-title', tabindex: '-1', 'data-focus': '1' }, 'Ориентировочная стоимость'));
    box.appendChild(el('p', { class: 'r-price' }, 'от ' + fmt(r.from) + ' до ' + fmt(r.to) + ' руб.'));
    var ul = el('ul', { class: 'r-list' });
    ul.appendChild(el('li', null, 'Септик и монтаж: ' + fmt(r.septic) + ' руб.'));
    if (r.pipe) ul.appendChild(el('li', null, 'Наружная труба: ' + r.pi.m + ' м × ' + P.pipePerM + ' руб. = ' + fmt(r.pipe) + ' руб.'));
    if (r.ac.add) ul.appendChild(el('li', null, 'Сложный подъезд: +' + fmt(r.ac.add) + ' руб.'));
    if (r.wi.add) ul.appendChild(el('li', null, 'Внутренняя разводка: +' + fmt(r.wi.add) + ' руб.'));
    box.appendChild(ul);
    box.appendChild(el('p', { class: 'muted' }, 'Это ориентир, а не окончательная цена. Точную смету назовёт мастер после бесплатного выезда.'));

    var form = el('form', { class: 'r-form', novalidate: 'novalidate' });
    form.appendChild(field('phone', 'Телефон', { type: 'tel', placeholder: '+375 44 123-45-67', autocomplete: 'tel', required: 'required', 'aria-describedby': 'err-phone' }));
    form.appendChild(field('name', 'Имя (необязательно)', { type: 'text', maxlength: '60', autocomplete: 'given-name', 'aria-describedby': 'err-name' }));
    var hp = el('div', { class: 'f hp', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { 'for': 'website' }, 'Не заполняйте'));
    hp.appendChild(el('input', { id: 'website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' }));
    form.appendChild(hp);
    var ck = el('div', { class: 'f check' });
    ck.appendChild(el('input', { type: 'checkbox', id: 'consent', required: 'required', 'aria-describedby': 'err-consent' }));
    var cl = el('label', { 'for': 'consent' }, 'Согласен на обработку данных по ');
    cl.appendChild(el('a', { href: '/privacy', target: '_blank', rel: 'noopener' }, 'политике конфиденциальности'));
    ck.appendChild(cl); ck.appendChild(el('small', { class: 'err', id: 'err-consent', role: 'alert' }));
    form.appendChild(ck);
    var send = el('button', { type: 'submit', class: 'btn' }, 'Отправить в Telegram');
    var again = el('button', { type: 'button', class: 'btn btn-line' }, 'Пройти заново');
    again.addEventListener('click', function () { step = 0; ans = {}; renderStep(); focusTitle(); });
    var row = el('div', { class: 'q-nav' }); row.appendChild(send); row.appendChild(again); form.appendChild(row);
    var status = el('p', { class: 'status', role: 'status' }); form.appendChild(status);
    box.appendChild(form);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); status.className = 'status'; status.textContent = '';
      var errs = {}, d = $('#phone').value.replace(/\D/g, '');
      if (!/^(375(25|29|33|44)\d{7}|80(25|29|33|44)\d{7})$/.test(d)) errs.phone = 'Введите белорусский номер, например +375 44 123-45-67';
      if (!$('#consent').checked) errs.consent = 'Нужно согласие на обработку данных';
      showErrors(errs); if (Object.keys(errs).length) return;
      var comment = 'Грунт: ' + r.so.label + '. Подъезд: ' + r.ac.label + '. Разводка: ' + r.wi.label + '. Расчёт на сайте: от ' + fmt(r.from) + ' до ' + fmt(r.to) + ' руб.';
      send.disabled = true; status.textContent = 'Отправляем…';
      fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ people: r.pe.people, pipeM: r.pi.m, district: ans.district, name: $('#name').value, phone: $('#phone').value, comment: comment, website: $('#website').value, consent: $('#consent').checked })
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.ok && /^https:\/\/t\.me\//.test(res.j.tgUrl)) { status.textContent = 'Готово. Открываем Telegram…'; window.location.href = res.j.tgUrl; }
          else { showErrors(res.j.errors || {}); status.className = 'status bad'; status.textContent = res.j.error || 'Проверьте поля формы.'; }
        })
        .catch(function () { status.className = 'status bad'; status.textContent = 'Нет связи с сервером. Напишите нам в Telegram: @zamvec'; })
        .then(function () { send.disabled = false; });
    });
  }
  function showErrors(errs) {
    ['phone', 'name', 'consent'].forEach(function (f) {
      var inp = $('#' + f), out = $('#err-' + f); if (!inp || !out) return;
      out.textContent = errs[f] || ''; if (errs[f]) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    });
    var first = ['phone', 'name', 'consent'].filter(function (f) { return errs[f]; })[0]; if (first) $('#' + first).focus();
  }
  renderStep();

  /* ---------- cookie ---------- */
  var cb = $('#cookie');
  function getCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? m[1] : null; }
  function setCookie(v) { document.cookie = 'cookie_consent=' + v + '; max-age=31536000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); }
  if (!getCookie('cookie_consent')) cb.hidden = false;
  cb.addEventListener('click', function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) { setCookie(c); cb.hidden = true; } });
  $('#cookie-open').addEventListener('click', function () { cb.hidden = false; cb.querySelector('button').focus(); });
})();
