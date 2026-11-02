(() => {
  'use strict';
  const SEARCH_WINDOW_MS = 30*60*1000;
  const FALLBACK_REFRESH_MS = 90*1000;
  function installHelper() {
  if (document.getElementById('sc-personal-helper')) return;
  const host = document.createElement('div');
  host.id = 'sc-personal-helper';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
  document.documentElement.append(host);
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{font:14px/1.45 system-ui;color:#17392c}*{box-sizing:border-box}
    section{width:min(350px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;padding:17px;background:#fff;border:2px solid #23865a;border-radius:14px;box-shadow:0 5px 30px #0003}
    strong{font-size:17px}p{margin:9px 0}label{display:block;margin:9px 0}input[type=text]{width:75px;padding:5px;border:1px solid #aaa;border-radius:5px}
    button{border:0;border-radius:7px;padding:10px;cursor:pointer;background:#23865a;color:white;margin:3px 3px 3px 0;font:inherit}
    button:disabled{opacity:.45;cursor:default}#stop{background:#a33434}small{display:block;color:#52665d}#status{padding:10px;background:#edf6f0;border-radius:6px;overflow-wrap:anywhere}
    details{margin-top:8px}#log{max-height:125px;overflow:auto;white-space:pre-wrap;font-size:11px}section.folded>*:not(header){display:none}header{display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:grab;touch-action:none;user-select:none;position:sticky;top:-17px;background:white;z-index:1}header:active{cursor:grabbing}select{font:inherit;padding:4px;max-width:100%}#fold,#reset{background:transparent;color:#17392c;padding:0 5px}
  </style><section><header id="drag" tabindex="0" title="Перетягуйте панель за заголовок; стрілки на клавіатурі також переміщують її"><strong>Помічник СЦ · 0.1.5</strong><span><button id="reset" title="Повернути панель праворуч униз">↺</button><button id="fold" title="Згорнути панель">−</button></span></header>
    <p>Ви обираєте послугу. Помічник починає з карти.</p>
    <label>Номер СЦ: <input id="center" type="text" value="2641" maxlength="4" inputmode="numeric"></label>
    <small>Карта сама оновлюється приблизно кожні 30 с. Якщо запити зупиняться, помічник оновить її через 90 с.</small>
    <label><input id="dry" type="checkbox"> Перевірка без бронювання</label>
    <small id="mode">Реальний запис: після вашої CAPTCHA помічник натисне «Далі» та підтвердить талон.</small>
    <button id="arm">Чекати 06:00</button><button id="now">Почати зараз</button><button id="stop" disabled>Стоп</button>
    <p id="status" role="status">Відкрийте карту після вибору послуги.</p>
    <small>Пошук до 30 хвилин. Найраніша дата → найраніший час. CAPTCHA проходите ви. Тримайте цю вкладку відкритою на екрані.</small>
    <details><summary>Перебіг роботи</summary><div id="log"></div></details>
  </section>`;
  const ui = id => root.getElementById(id);
  const positionKey = 'sc-helper-panel-position-v1';
  const panel = root.querySelector('section');
  const handle = ui('drag');
  let drag = null;
  function place(x,y) {
    const box = host.getBoundingClientRect();
    const left = Math.max(8,Math.min(x,Math.max(8,innerWidth-box.width-8)));
    const top = Math.max(8,Math.min(y,Math.max(8,innerHeight-box.height-8)));
    host.style.left = `${left}px`;host.style.top = `${top}px`;
    host.style.right = 'auto';host.style.bottom = 'auto';
  }
  function clamp() { const box=host.getBoundingClientRect();place(box.left,box.top); }
  function savePosition() {
    const {left:x,top:y}=host.getBoundingClientRect();
    try { localStorage.setItem(positionKey,JSON.stringify({x,y})); } catch { /* Position remains usable without storage. */ }
  }
  try {
    const saved=JSON.parse(localStorage.getItem(positionKey));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x,saved.y);
  } catch { /* Ignore unavailable storage or an invalid saved position. */ }
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0 || event.target.closest('button'))return;
    const box=host.getBoundingClientRect();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top};
    handle.setPointerCapture(event.pointerId);event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    place(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);
  });
  const endDrag=event=>{
    if(!drag || event.pointerId!==drag.id)return;
    drag=null;savePosition();
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
  };
  handle.addEventListener('pointerup',endDrag);
  handle.addEventListener('pointercancel',endDrag);
  handle.addEventListener('lostpointercapture',event=>{if(drag && event.pointerId===drag.id){drag=null;savePosition();}});
  handle.addEventListener('keydown',event=>{
    if(event.target!==handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    const box=host.getBoundingClientRect(),step=event.shiftKey?40:10;
    place(box.left+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),box.top+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0));
    savePosition();event.preventDefault();
  });
  ui('reset').onclick=()=>{
    try {localStorage.removeItem(positionKey);}catch{}
    host.style.left='auto';host.style.top='auto';host.style.right='16px';host.style.bottom='16px';
    clamp();
  };
  window.addEventListener('resize',()=>{clamp();savePosition();});
  new ResizeObserver(()=>{if(!host.hidden)clamp();}).observe(panel);
  requestAnimationFrame(clamp);
  const norm = t => (t || '').replace(/\s+/g, ' ').trim();
  const text = e => norm(e?.innerText ?? e?.textContent);
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const enabled = e => e && !e.disabled && !e.matches(':disabled') && e.getAttribute('aria-disabled') !== 'true' && e.getAttribute('aria-busy') !== 'true' && !e.classList.contains('Mui-disabled');
  const buttons = () => [...document.querySelectorAll('main button')].filter(visible);
  const exactButton = value => buttons().find(e => text(e) === value && enabled(e));
  const continueButton = () => {
    const candidates = buttons().filter(e => /^(?:Далі|Продовжити|Підтвердити|Підтвердити запис)[\s→›»]*$/iu.test(text(e)) && enabled(e));
    if (candidates.length > 1) throw Error('Знайдено кілька кнопок продовження. Перевірте сторінку вручну.');
    return candidates[0];
  };
  const heading = () => norm(document.querySelector('main h3')?.textContent);
  const isMap = () => heading() === 'Оберіть сервісний центр МВС';
  let run = null;
  let audio;
  let busy = false;
  let lastLog = '';
  let rateLimitedUntil = 0;
  function status(message) {
    ui('status').textContent = message;
    if (message === lastLog) return;
    lastLog = message;
    const log = ui('log');
    log.textContent += `${new Date().toLocaleTimeString('uk-UA')} ${message}\n`;
    const lines = log.textContent.split('\n');
    if (lines.length > 60) log.textContent = lines.slice(-60).join('\n');
  }
  function sound() {
    if (!audio || audio.state !== 'running') return;
    try { for (let i = 0; i < 3; i++) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.connect(gain); gain.connect(audio.destination);
      const at = audio.currentTime + i * .25;
      osc.frequency.value = 880; gain.gain.setValueAtTime(.08, at);
      gain.gain.exponentialRampToValueAtTime(.001, at + .18);
      osc.start(at); osc.stop(at + .2);
    } } catch { /* Keep visual feedback if audio is unavailable. */ }
  }
  function controls(active) {
    ['arm','now','center','dry'].forEach(id => ui(id).disabled = active);
    ui('stop').disabled = !active;
  }
  function stop(message = 'Зупинено.') {
    const r = run;
    run = null;
    if (r) { r.abort.abort(); r.release?.(); }
    controls(false); status(message);
  }
  function fail(message) { sound(); stop(message); }
  const alive = r => run === r && !r.abort.signal.aborted;
  const pause = (r, ms) => new Promise(resolve => {
    if (!alive(r)) return resolve();
    const done = () => { clearTimeout(timer); r.abort.signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    r.abort.signal.addEventListener('abort', done, {once: true});
  });
  async function waitFor(r, predicate, timeout = 12000) {
    const end = performance.now() + timeout;
    while (alive(r) && performance.now() < end) {
      if (location.pathname !== '/cabinet/queue') throw Error('Сесія завершилася або сторінка змінилася. Авторизуйтеся та запустіть помічника з карти знову.');
      const value = predicate();
      if (value) return value;
      await pause(r, 50);
    }
    if (alive(r)) throw Error('Сайт не завершив перехід. Перевірте сторінку й запустіть помічника з карти знову.');
    return null;
  }
  async function click(r, element, predicate) {
    if (!alive(r) || !element || !enabled(element)) return null;
    element.click();
    return predicate ? waitFor(r, predicate) : true;
  }
  // Labels verified against the site's service catalogue on 2026-10-14.
  // No extra catalogue request: returning to the service step already requests it.
  // Changed or ambiguous labels fail closed instead of choosing another service.
  function servicePath() {
    const label = text(buttons()[0]);
    const center = ['категорія А1','категорія А (механична КПП)','категорія В (механічна КПП)',
      'категорія В (автоматична КПП)','категорія С1','категорія С','категорія D1','категорія CE','категорія А (автоматична КПП)'];
    const school = ['категорія А1, А, В1','категорія В','категорії С1, С, D1, D','категорії ВЕ, С1Е, СЕ, D1E, DE'];
    const group = center.includes(label) ? 'Практичний іспит на транспортному засобі Сервісного центру МВС'
      : school.includes(label) ? 'Практичний іспит на транспортному засобі навчального закладу' : null;
    if (!group) throw Error('Не вдалося визначити практичний іспит. Можливо, сайт змінив назви послуг. Зупинено.');
    return ['Практичний іспит',group,label];
  }
  function targetCenter(r) {
    return buttons().find(e => new RegExp(`^ТСЦ МВС №\\s*${r.center}(?:\\s|$)`).test(text(e)));
  }
  function receipt() {
    const main = norm(document.querySelector('main')?.textContent);
    return /Ваш номер у черзі/i.test(main) ? (main.match(/\b\d{3,}\b/)?.[0] || 'отримано') : null;
  }
  function hasTarget(r) {
    return [...document.querySelectorAll('main p,main button')].some(e =>
      new RegExp(`^ТСЦ МВС №\\s*${r.center}(?!\\d)`).test(text(e)));
  }
  function dateKey(value) {
    const months = ['січ','лют','бер','квіт','трав','черв','лип','серп','вер','жовт','листоп','груд'];
    const lower = norm(value).toLowerCase();
    const parts = lower.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
    if (!parts) return null;
    const month = months.findIndex(stem => parts[2].startsWith(stem));
    return month < 0 ? null : `${parts[3]}-${month+1}-${Number(parts[1])}`;
  }
  async function refreshMap(r) {
    r.phase = 'refresh';
    status('Оновлюю карту, зберігаючи обрану послугу…');
    const selected = exactButton(r.path.at(-1));
    if (!selected) throw Error('Змінився вигляд сторінки карти. Зупинено.');
    await click(r, selected, () => heading() === 'Оберіть послугу');
    for (let index = 0; index < r.path.length; index++) {
      const option = await waitFor(r, () => exactButton(r.path[index]));
      if (!alive(r)) return;
      await click(r, option, () => index === r.path.length - 1 ? isMap() : exactButton(r.path[index+1]));
    }
    await waitFor(r, () => isMap() && targetCenter(r));
    r.lastDepartmentsAt = performance.now();
    r.phase = 'map';
  }
  function dates() {
    // Both visible calendars are in chronological DOM order. Hidden next-month calendars are excluded.
    return [...document.querySelectorAll('main .react-calendar__month-view__days__day')]
      .filter(e => visible(e) && enabled(e) && !e.classList.contains('react-calendar__month-view__days__day--neighboringMonth'));
  }
  function times() {
    return [...document.querySelectorAll('main p,main button')]
      .filter(e => visible(e) && enabled(e) && /^\d{2}:\d{2}$/.test(text(e)) && getComputedStyle(e).cursor === 'pointer')
      .sort((a,b) => text(a).localeCompare(text(b)));
  }
  async function step(r) {
    if (!alive(r)) return;
    const number = receipt();
    if (number) { sound(); stop(`Талон отримано: ${number}. Перевірте запис у кабінеті.`); return; }
    if (document.hidden) {
      if (!r.hiddenAt) { r.hiddenAt = performance.now(); status('Поверніться до вкладки — робота призупинена.'); }
      if (performance.now() - r.hiddenAt > 30000) fail('Вкладка була прихована понад 30 с. Відкрийте карту та запустіть помічника знову.');
      return;
    }
    r.hiddenAt = null;
    if (location.pathname !== '/cabinet/queue') throw Error('Сторінка змінилася або потрібен повторний вхід.');
    const alerts = [...document.querySelectorAll('[role="alert"],[role="dialog"],.SnackbarContent-root,.notistack-SnackbarContainer')]
      .filter(visible).map(text).filter(Boolean);
    if (alerts.length) throw Error(`Повідомлення сайту: ${alerts.join(' ').slice(0,350)}. Зупинено для перевірки.`);
    if (r.phase === 'armed') {
      if (Date.now() < r.startAt) {
        const seconds = Math.ceil((r.startAt - Date.now()) / 1000);
        status(`Готовий. До 06:00 за Києвом: ${Math.floor(seconds/60)} хв ${seconds%60} с. Послуга: ${r.path.at(-1)}.`);
        return;
      }
      if (Date.now() - r.startAt > 15000) throw Error('Пропущено час запуску: комп’ютер або вкладка могли заснути. Запустіть «Почати зараз» з карти.');
      r.phase = 'map';
      r.deadline = performance.now() + SEARCH_WINDOW_MS;
      await refreshMap(r);
      return;
    }
    if (performance.now() > r.deadline) throw Error('Минуло 30 хвилин. Зупинено; за потреби запустіть знову з карти.');
    const h = heading();
    if (h === 'Оберіть сервісний центр МВС') {
      r.phase = 'map';
      const center = targetCenter(r);
      if (center && enabled(center)) {
        status(`Є місця у СЦ №${r.center}. Обираю…`);
        await click(r, center, () => heading() !== h);
        return;
      }
      if (performance.now() - r.lastDepartmentsAt >= FALLBACK_REFRESH_MS) { await refreshMap(r); return; }
      status(`Очікую місце у СЦ №${r.center}. Карта оновлюється автоматично.`);
    } else if (h === 'Оберіть дату') {
      if (!hasTarget(r)) throw Error('Відкрито інший СЦ. Зупинено.');
      const first = dates()[0];
      if (!first) { status('Очікую завантаження доступних дат…'); return; }
      r.date = first.querySelector('abbr')?.getAttribute('aria-label') || text(first);
      status(`Обираю найранішу дату: ${r.date}.`);
      await click(r, first, () => heading() !== h || enabled(continueButton()));
      if (heading() === h) {
        const next = continueButton();
        if (next) await click(r, next, () => heading() !== h);
      }
    } else if (h === 'Оберіть час') {
      if (!hasTarget(r)) throw Error('Відкрито інший СЦ. Зупинено.');
      const options = times();
      if (!options.length) { status('Очікую доступний час…'); return; }
      if (!r.time || !options.some(e => text(e) === r.time)) {
        r.time = text(options[0]);
        options[0].click();
        sound();
        if (r.dry) { stop(`Перевірку завершено: СЦ №${r.center}, ${r.date}, ${r.time}. Бот зупинений. Для запису вимкніть «Перевірка без бронювання» та запустіть з карти.`); return; }
        r.captchaAt = performance.now();
      }
      // The website enables Next only after the user's genuine CAPTCHA and time selection.
      // No access to CAPTCHA frames, tokens, callbacks, or challenge-solving services.
      const next = continueButton();
      if (next) {
        if (r.bookingSent) throw Error('Повторне бронювання автоматично не надсилається. Перевірте результат у кабінеті.');
        r.bookingSent = true;
        status('CAPTCHA пройдено. Надсилаю бронювання…');
        await click(r, next, () => heading() !== h);
      } else {
        status(`Обрано ${r.date}, ${r.time}. Пройдіть CAPTCHA «Я не робот» на сторінці.`);
        if (performance.now() - r.captchaAt > 120000) throw Error('Очікування CAPTCHA перевищило 2 хвилини. Перевірте доступність і запустіть з карти знову.');
      }
    } else if (h === 'Контактна інформація') {
      if (r.dry || !r.bookingSent) throw Error('Неочікуваний перехід до підтвердження. Зупинено.');
      if (!hasTarget(r)) throw Error('СЦ у підтвердженні не збігається. Зупинено.');
      const selectedDate = dateKey(r.date);
      if (!selectedDate || ![...document.querySelectorAll('main p')].some(e => dateKey(text(e)) === selectedDate)) throw Error('Дата у підтвердженні не збігається. Перевірте вручну.');
      const main = text(document.querySelector('main'));
      if (!main.includes(r.time) || !main.includes(r.path.at(-1))) throw Error('Параметри підтвердження змінилися. Перевірте їх вручну.');
      const next = continueButton();
      if (!next) {
        if (!r.contactsAlert) { r.contactsAlert = true; sound(); }
        status('Заповніть телефон та e-mail на сайті. Після цього помічник підтвердить талон.');
        return;
      }
      if (r.confirmSent) return;
      r.confirmSent = true;
      status('Завершую оформлення талона…');
      next.click();
      await waitFor(r, () => receipt(), 15000);
      if (alive(r)) { sound(); stop(`Талон отримано: ${receipt()}. Перевірте запис у кабінеті.`); }
    } else throw Error('Неочікуваний крок сайту. Поверніться на карту та запустіть помічника знову.');
  }
  // Europe/Kyiv currently uses whole-hour UTC offsets; calculate using the named time zone, not OS time zone.
  function nextSix(now) {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    const get = k => Number(parts.find(p=>p.type===k).value);
    const midnightUTC = Date.UTC(get('year'),get('month')-1,get('day'));
    const candidate = day => {
      const dateParts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
      for(let hour=0;hour<=8;hour++) {
        const t = day + hour*3600000;
        const p = dateParts.formatToParts(new Date(t));
        if(Number(p.find(x=>x.type==='hour').value)===6) return t;
      }
      throw Error('Не вдалося визначити 06:00 за Києвом.');
    };
    const today = candidate(midnightUTC);
    return today > now ? today : candidate(midnightUTC+86400000);
  }
  async function start(armed) {
    if (run) return;
    if (Date.now() < rateLimitedUntil) return status('Сайт обмежив запити. Зачекайте щонайменше хвилину та перевірте сторінку перед новим запуском.');
    if (!isMap()) return status('Спочатку оберіть практичний іспит і відкрийте карту СЦ.');
    if (innerWidth < 1000) return status('Розгорніть вікно браузера до ширини щонайменше 1000 px, щоб бачити обидва календарі.');
    if (!/^\d{4}$/.test(ui('center').value)) return status('Номер СЦ має містити 4 цифри.');
    if (!navigator.locks) return status('Потрібен актуальний Chrome із підтримкою блокування роботи в кількох вкладках.');
    try { audio ||= new AudioContext(); await audio.resume(); } catch { /* Visual status remains available. */ }
    if (run) return;
    const r = {abort:new AbortController(),center:ui('center').value,dry:ui('dry').checked,phase:'preparing',lastDepartmentsAt:performance.now(),deadline:performance.now()+SEARCH_WINDOW_MS};
    run = r; controls(true); status('Перевіряю обрану послугу…');
    navigator.locks.request('sc-personal-helper-single-booking',{ifAvailable:true},async lock => {
      if (!alive(r)) return;
      if (!lock) { stop('Помічник уже працює в іншій вкладці цього сайту.'); return; }
      try {
        r.path = await servicePath(r);
        if (!alive(r)) return;
        if (!targetCenter(r)) throw Error(`СЦ №${r.center} не видно у списку. Очистіть пошук на карті та запустіть знову.`);
        r.startAt = nextSix(Date.now());
        r.phase = armed ? 'armed' : 'map';
        r.lastDepartmentsAt = performance.now();
        await new Promise(resolve => { r.release = resolve; if (!alive(r)) resolve(); });
      } catch (error) { if (alive(r)) fail(error.message); }
    }).catch(error => { if (alive(r)) fail(error.message); });
  }
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const url = new URL(entry.name,location.href);
      if (run?.phase === 'map' && url.origin === location.origin && url.pathname === '/api/v2/equeue/departments' && (entry.responseStatus === 0 || entry.responseStatus >= 200 && entry.responseStatus < 300)) run.lastDepartmentsAt = performance.now();
      if (url.origin === location.origin && url.pathname.startsWith('/api/') && entry.responseStatus === 429) {
        rateLimitedUntil = Date.now()+60000;
        if (run) fail('Сайт обмежив запити (HTTP 429). Зупинено. Зачекайте щонайменше хвилину; автоматичного повторення не буде.');
      }
    }
  }).observe({type:'resource'});
  ui('arm').onclick = () => start(true);
  ui('now').onclick = () => start(false);
  ui('stop').onclick = () => stop();
  ui('fold').onclick = () => ui('fold').closest('section').classList.toggle('folded');
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && run) stop(); });
  let queued = false;
  let pending = false;
  async function pump() {
    if (!run || run.phase === 'preparing') return;
    if (busy) { pending = true; return; }
    busy = true;
    const r = run;
    try { await step(r); } catch(error) { if (alive(r)) fail(error.message); }
    finally {
      busy = false;
      if (pending) { pending = false; kick(); }
    }
  }
  function kick() {
    if (queued || !run) return;
    queued = true;
    queueMicrotask(() => { queued = false; void pump(); });
  }
  // Observe the site's button becoming usable. The helper's own shadow tree and
  // CAPTCHA iframe contents are excluded. The interval remains a fallback.
  new MutationObserver(kick).observe(document.body,{
    subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:['disabled','aria-disabled','aria-busy','class']
  });
  document.addEventListener('visibilitychange',kick);
  document.addEventListener('input',kick,true);
  document.addEventListener('change',kick,true);
  ui('dry').onchange = () => {
    ui('mode').textContent = ui('dry').checked
      ? 'Перевірка: помічник зупиниться після вибору часу й не створить бронювання.'
      : 'Реальний запис: після вашої CAPTCHA помічник натисне «Далі» та підтвердить талон.';
  };
  setInterval(pump,100);

  }
  const boot = () => {
    const host = document.getElementById('sc-personal-helper');
    if (host) host.hidden = location.pathname !== '/cabinet/queue';
    if (location.pathname === '/cabinet/queue') installHelper();
  };
  new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true});
  boot();
})();
