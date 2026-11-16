'use strict';
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var PIPE_RUB = 30;        // руб. за погонный метр наружной трубы
  var LITERS_PER_DAY = 200; // норма водоотведения на человека
  var DAYS = 3;             // запас объёма в сутках
  var DISTRICTS = ['Гомель', 'Речица', 'Добруш', 'Чечерск', 'Корма', 'Светлогорск', 'Ветка', 'Наровля', 'Петриков',
    'Хойники', 'Ельск', 'Довск', 'Брагин', 'Лельчицы', 'Рогачёв', 'Жлобин', 'Калинковичи', 'Лоев', 'Другой населённый пункт'];
  var fmt = function (n) { return n.toLocaleString('ru-RU'); };

  // Районы: список и селект (через textContent — без innerHTML)
  var sel = $('#district'), chips = $('#chips');
  DISTRICTS.forEach(function (d, i) {
    var o = document.createElement('option'); o.value = d; o.textContent = d; if (i === 0) o.selected = true; sel.appendChild(o);
    if (i < DISTRICTS.length - 1) { var li = document.createElement('li'); li.textContent = d; chips.appendChild(li); }
  });
  $('#year').textContent = new Date().getFullYear();

  // Меню на мобильных
  var burger = $('#burger'), nav = $('#nav');
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); burger.focus(); } });

  // Ориентир по объёму и трубе
  var people = $('#people'), pipe = $('#pipeM');
  function toInt(el, min, max) { var v = parseInt(el.value, 10); return isNaN(v) ? min : Math.min(Math.max(v, min), max); }
  function recalc() {
    var p = toInt(people, 1, 20), m = toInt(pipe, 0, 200);
    var vol = p * LITERS_PER_DAY * DAYS / 1000;
    $('#r-vol').textContent = 'Ориентировочный объём септика: ' + vol.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' м³ (' + LITERS_PER_DAY + ' л на человека в сутки на ' + DAYS + ' суток).';
    $('#r-pipe').textContent = m > 0 ? 'Наружная труба: ' + fmt(m) + ' м × ' + PIPE_RUB + ' ₽ = ' + fmt(m * PIPE_RUB) + ' ₽.' : 'Наружная труба не нужна.';
  }
  people.addEventListener('input', recalc); pipe.addEventListener('input', recalc); recalc();

  // Отправка заявки (проверка повторяется на сервере)
  var form = $('#lead'), status = $('#status'), send = $('#send');
  var fields = ['people', 'pipeM', 'district', 'name', 'phone', 'consent'];
  function showErrors(errs) {
    fields.forEach(function (f) {
      var el = $('#' + f), out = $('#err-' + f), msg = errs && errs[f];
      out.textContent = msg || ''; if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
    var first = errs && fields.filter(function (f) { return errs[f]; })[0];
    if (first) $('#' + first).focus();
  }
  function localCheck() {
    var e = {}, d = $('#phone').value.replace(/\D/g, '');
    if (!/^(375(25|29|33|44)\d{7}|80(25|29|33|44)\d{7})$/.test(d)) e.phone = 'Введите белорусский номер, например +375 44 123-45-67';
    if (!$('#consent').checked) e.consent = 'Нужно согласие на обработку данных';
    return Object.keys(e).length ? e : null;
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault(); status.className = 'status'; status.textContent = '';
    var le = localCheck(); showErrors(le); if (le) return;
    send.disabled = true; status.textContent = 'Отправляем…';
    fetch('/api/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        people: toInt(people, 1, 20), pipeM: toInt(pipe, 0, 200), district: sel.value, name: $('#name').value,
        phone: $('#phone').value, comment: $('#comment').value, website: $('#website').value, consent: $('#consent').checked
      })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok && /^https:\/\/t\.me\//.test(res.j.tgUrl)) {
          status.textContent = 'Готово. Открываем Telegram…';
          window.location.href = res.j.tgUrl;
        } else {
          showErrors(res.j.errors); status.className = 'status bad';
          status.textContent = res.j.error || 'Проверьте поля формы.';
        }
      })
      .catch(function () { status.className = 'status bad'; status.textContent = 'Нет связи с сервером. Напишите нам в Telegram: @zamvec'; })
      .then(function () { send.disabled = false; });
  });

  // Cookie: один необходимый cookie с выбором пользователя
  var box = $('#cookie');
  function getCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? m[1] : null; }
  function setCookie(v) {
    document.cookie = 'cookie_consent=' + v + '; max-age=31536000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  if (!getCookie('cookie_consent')) box.hidden = false;
  box.addEventListener('click', function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) { setCookie(c); box.hidden = true; } });
  $('#cookie-open').addEventListener('click', function () { box.hidden = false; box.querySelector('button').focus(); });
})();
