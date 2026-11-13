// Мини-приложение Питоши: дорожка уроков, урок, финиш, профиль, рейтинг, магазин.
(function () {
  const C = window.CORE;
  // Курс выбранного языка: Python всегда в course.js, остальные подгружаются из courses/<язык>.js
  let UNITS, LESSONS, lessonById, lessonIndex, LANG = 'python';
  function useLang(lang) {
    const c = lang === 'python' ? window.COURSE : (window.COURSES || {})[lang];
    LANG = c ? lang : 'python';
    ({ UNITS, LESSONS, lessonById, lessonIndex } = c || window.COURSE);
  }
  function loadLang(lang) {
    lang = C.cleanLang(lang);
    if (lang === 'python' || (window.COURSES || {})[lang]) { useLang(lang); return Promise.resolve(); }
    return new Promise(ok => {
      const s = document.createElement('script');
      s.src = `courses/${lang}.js?v=${Date.now() >> 22}`;
      s.onload = () => { useLang(lang); ok(); };
      s.onerror = () => { useLang('python'); ok(); };
      document.head.appendChild(s);
    });
  }
  useLang('python');
  const langName = () => C.langInfo(LANG).name;
  // Сообщение, пока качается движок языка (Python и Lua скачиваются при первом запуске)
  const loadingMsg = () => (window.RUN.isWarm(LANG) ? '' : `⏳ Загружаю ${LANG === 'lua' ? 'Lua' : 'Python'} (только в первый раз, ~10 секунд)…`);
  const api = window.API;
  const { I, svgify, ent } = window.ICONS; // SVG-иконки вместо эмодзи
  const tg = window.Telegram && window.Telegram.WebApp;
  const $app = document.getElementById('app');

  const S = { tab: 'learn', view: 'tabs', player: null, L: null, finish: null, top: null, promo: null, P: null, sandbox: null,
    topMode: 'xp', shopSide: 'stars', fr: null, snip: null, snips: null };

  // Хранилище браузера: черновики кода, тема, вибрация. Может быть недоступно — тогда просто не запоминаем.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
  };
  async function copyText(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done || 'Скопировано'); } catch (e) { toast(text); }
  }
  // Поделиться ссылкой через окно «Переслать» в Telegram
  function shareLink(link, text) {
    haptic();
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
  }

  // ---------- Telegram ----------
  if (tg) {
    tg.ready(); tg.expand();
    try { tg.setHeaderColor('#0d1f3c'); tg.setBackgroundColor('#0d1f3c'); } catch (e) { /* старый клиент */ }
    if (tg.BackButton) tg.BackButton.onClick(() => {
      if (S.view === 'lesson') askQuit();
      else if (S.view === 'register' && S.reg && S.reg.first) return; // без имени дальше нельзя
      else { S.view = 'tabs'; render(); }
    });
  }
  const haptic = kind => { if (store.get('pitosha-vibro') === 'off') return; try { if (kind === 'ok' || kind === 'bad') tg.HapticFeedback.notificationOccurred(kind === 'ok' ? 'success' : 'error'); else tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* не в Telegram */ } };

  // ---------- Помощники ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function toast(text) {
    const t = document.getElementById('toast');
    t.innerHTML = svgify(esc(text)); t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const mins = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`; };
  const days = n => (n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней');

  // Подсветка Python-кода
  const KW = new Set(('if elif else for while def return import from in and or not True False None class pass break continue' +
    ' let const var function true false null undefined new this of switch case do then end local nil elseif repeat until' +
    ' int double float bool char void string public private static using namespace include std struct SELECT FROM WHERE ORDER BY LIMIT AND OR INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE JOIN ON GROUP').split(' '));
  const FN = new Set('print len input int str float range upper lower list dict sum max min abs round type console log prompt Number String tonumber tostring ipairs pairs Console WriteLine cout cin endl'.split(' '));
  function highlight(code) {
    const re = /(___)|([fF]?"[^"\n]*"?|[fF]?'[^'\n]*'?)|(\d+\.?\d*)|([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)|([+\-*/%=<>!]+|[()[\]{}.,:])|(\s+)|(.)/g;
    let out = '', m;
    while ((m = re.exec(code))) {
      const [t, blank, str, num, id, op] = m;
      if (blank) out += `<span class="tok-blank">${esc(t)}</span>`;
      else if (str) out += `<span class="tok-str">${esc(t)}</span>`;
      else if (num) out += `<span class="tok-num">${esc(t)}</span>`;
      else if (id) out += KW.has(t) ? `<span class="tok-kw">${t}</span>` : FN.has(t) ? `<span class="tok-fn">${t}</span>` : esc(t);
      else if (op) out += `<span class="tok-op">${esc(t)}</span>`;
      else out += esc(t);
    }
    return out;
  }

  // ---------- Загрузка ----------
  async function load() {
    const r = await api.state();
    if (r.error) { $app.innerHTML = `<div class="center">${window.pitosha({ mood: 'sad', size: 140 })}<h1>Не получилось загрузиться</h1><p>Открой Питошу через бота @pythonshkabot</p></div>`; return; }
    S.player = r.player;
    S.promo = r.promo || null;
    await loadLang(S.player.lang);
    applyTheme();
    // Первый вход — знакомимся: аватарка и имя для рейтинга
    if (!S.player.profile || !S.player.profile.name) openRegister(true);
    render();
    // Открыли по ссылке на чужой код (кнопка «Запустить в Питоше» из бота)
    const shared = new URLSearchParams(location.search).get('code');
    if (shared && S.view === 'tabs') openSnippet(shared);
  }

  // ---------- Знакомство: новичок или знаю основы ----------
  function onboardScreen() {
    return `<div class="center">${window.pitosha({ size: 130 })}
      <h1>Ты уже знаешь Python?</h1>
      <p>Подберу, с чего начать</p>
      <div class="choice-cards">
        <button class="card choice-card" data-act="onb-new"><span>🌱</span><b>Я новичок</b><small>Начнём с самого первого урока</small></button>
        <button class="card choice-card" data-act="onb-test"><span>🚀</span><b>Знаю основы</b><small>Короткий тест: ${C.PLACEMENT_UNITS} вопросов — пропустим то, что ты уже знаешь</small></button>
      </div></div>`;
  }
  function startPlacement() {
    const qs = C.placementQuestions(UNITS);
    S.P = { qs, i: 0, answers: [], order: shuffle(qs[0].q.options.map((_, k) => k)), result: null };
    S.view = 'placement';
    render();
  }
  function placementScreen() {
    const P = S.P;
    if (P.result) {
      const k = P.result.skipped;
      return `<div class="center"><div class="bounce">${window.pitosha({ size: 140 })}</div>
        <h1>${k ? `Пропускаем ${k} ${k === 1 ? 'раздел' : k < 5 ? 'раздела' : 'разделов'}! 🚀` : 'Начнём с основ 🌱'}</h1>
        <p>${k ? `Ты знаешь темы с 1-го по ${k}-й раздел. Начнёшь с раздела ${k + 1}, а к пропущенным урокам можно вернуться в любой момент.` : 'Ничего страшного — с первых уроков пойдёт быстро, а знакомое будет повторением.'}</p>
        <div class="bottom"><div class="bottom-inner"><button class="big" data-act="home">Поехали</button></div></div></div>`;
    }
    const cur = P.qs[P.i], q = cur.q;
    return `<div class="lesson"><div class="lesson-top"><button class="close" data-act="home" aria-label="Выйти">✕</button>
      <div class="progress"><i style="width:${(P.i / P.qs.length) * 100}%"></i></div><div class="stat">${P.i + 1}/${P.qs.length}</div></div>
      <div class="q-area"><div class="q-kind">Тест · раздел ${P.i + 1}</div><div class="q-text">${esc(q.q)}</div>
      ${q.code ? `<pre class="code">${highlight(q.code)}</pre>` : ''}
      <div class="options">${P.order.map((orig, k) => `<button class="opt" data-place="${orig}">${esc(q.options[orig])}</button>`).join('')}</div>
      <button class="idk" data-place="idk">Не знаю 🤷</button></div></div>`;
  }
  async function placementAnswer(v) {
    const P = S.P;
    P.answers.push(v === 'idk' ? null : Number(v));
    haptic();
    // Ошибка — дальше можно не спрашивать: пропускаем только разделы, отвеченные подряд с начала
    if (P.answers[P.answers.length - 1] !== 0 || P.i + 1 >= P.qs.length) {
      const r = await api.placement(P.answers);
      if (r.player) S.player = r.player;
      P.result = { skipped: r.skipped || 0 };
      haptic('ok');
      return render();
    }
    P.i++;
    P.order = shuffle(P.qs[P.i].q.options.map((_, k) => k));
    render();
  }

  // ---------- Ежедневный бонус и ачивки ----------
  async function claimDaily() {
    const r = await api.daily();
    if (r.player) S.player = r.player;
    if (r.error || !r.daily) return render();
    const d = r.daily;
    haptic('ok');
    toast(`🎁 День ${d.day}: +${d.xp} XP${d.freeze ? ' и 🧊 заморозка серии!' : ''}`);
    celebrate();
    render();
    if (d.ach && d.ach.length) setTimeout(() => showAch(d.ach), 2700);
  }
  function showAch(list) {
    if (!list || !list.length) return;
    toast(list.map(a => `${a.ico} Новая ачивка: ${a.title}`).join(' · '));
  }
  // Салют из эмодзи — для финиша урока, бонуса и ачивок
  function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const items = ['party', 'star', 'sparkle', 'gem', 'heart', 'fire'];
    for (let k = 0; k < 26; k++) {
      const s = document.createElement('span');
      s.innerHTML = I(items[k % items.length]);
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDelay = Math.random() * 0.5 + 's';
      s.style.fontSize = 16 + Math.random() * 18 + 'px';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2600);
  }

  // ---------- Темы оформления ----------
  const THEMES = [
    { id: 'ocean', name: 'Океан', ico: '🌊' },
    { id: 'night', name: 'Ночь', ico: '🌙' },
    { id: 'forest', name: 'Лес', ico: '🌲', plus: true },
    { id: 'sunset', name: 'Закат', ico: '🌅', plus: true },
    { id: 'candy', name: 'Конфета', ico: '🍬', plus: true },
  ];
  const canPlus = () => !!(S.player && (S.player.plus || S.player.admin));
  function applyTheme() {
    let id = store.get('pitosha-theme') || 'ocean';
    const t = THEMES.find(x => x.id === id);
    if (!t || (t.plus && !canPlus())) id = 'ocean'; // Плюс закончился — возвращаем обычную тему
    document.documentElement.dataset.theme = id;
  }
  function pickTheme(id) {
    const t = THEMES.find(x => x.id === id);
    if (!t) return;
    if (t.plus && !canPlus()) { toast('👑 Эта тема — в Питоше Плюс'); S.tab = 'shop'; S.view = 'tabs'; return render(); }
    store.set('pitosha-theme', id);
    applyTheme();
    haptic();
    render();
  }

  // ---------- Регистрация / профиль ----------
  function openRegister(first) {
    const p = S.player.profile || {};
    const tgName = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name;
    S.reg = { first, avatar: p.avatar || C.AVATARS[0], name: p.name || (C.cleanName(tgName).ok ? C.cleanName(tgName).name : ''), error: '' };
    S.view = 'register';
  }
  // Аватарка: эмодзи или своё фото (data:image/… — проверено C.isPhoto, поэтому безопасно для src)
  function avatarHtml(a) {
    if (C.isPhoto(a)) return `<img class="av-img" src="${a}" alt="">`;
    return `<span class="emo">${ent(C.AVATARS.includes(a) ? a : C.AVATARS[0])}</span>`; // эмодзи-аватарка остаётся эмодзи
  }
  // Фото с телефона/компьютера → квадрат 128×128 по центру → JPEG поменьше
  async function photoToAvatar(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
      for (const [size, quality] of [[128, 0.82], [128, 0.65], [96, 0.6], [80, 0.5]]) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        cv.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        const data = cv.toDataURL('image/jpeg', quality);
        if (C.isPhoto(data)) return data;
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  }
  async function onPhotoPicked(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const nameInput = document.getElementById('reg-name');
    if (nameInput) S.reg.name = nameInput.value;
    if (!/^image\//.test(file.type || 'image/')) { toast('Это не картинка 🙈'); return; }
    if (file.size > 15 * 1024 * 1024) { toast('Слишком большой файл — выбери фото поменьше'); return; }
    let data = null;
    try { data = await photoToAvatar(file); } catch (e) { data = null; }
    if (!data) { toast('Не получилось открыть фото, попробуй другое'); return; }
    S.reg.avatar = data;
    haptic('ok');
    render();
  }

  function registerScreen() {
    const R = S.reg;
    const own = C.isPhoto(R.avatar);
    return `<div class="center reg">
      <div class="reg-avatar">${avatarHtml(R.avatar)}</div>
      <h1>${R.first ? 'Давай знакомиться!' : 'Твой профиль'}</h1>
      <p>${R.first ? 'Выбери аватарку и имя — их увидят все в таблице лидеров 🏆' : 'Аватарка и имя видны в таблице лидеров'}</p>
      <label class="photo-btn ${own ? 'sel' : ''}">📷 ${own ? 'Выбрать другое фото' : 'Своё фото с телефона или компьютера'}
        <input type="file" id="photo-input" accept="image/*" hidden></label>
      <div class="avatar-grid">${C.AVATARS.map(a => `<button class="av ${a === R.avatar ? 'sel' : ''}" data-avatar="${a}">${ent(a)}</button>`).join('')}</div>
      <input class="answer-input name-input" id="reg-name" maxlength="16" autocomplete="off" placeholder="Твоё имя или ник" value="${esc(R.name)}">
      <div class="reg-error">${esc(R.error || '')}</div>
      <p class="note">Не пиши фамилию, школу и адрес — это видят все. Фото тоже видно всем: лучше не ставь своё лицо, выбери картинку или рисунок.</p>
      <div class="bottom"><div class="bottom-inner">
        <button class="big" data-act="save-profile">${R.first ? 'Начать учиться' : 'Сохранить'}</button>
        ${R.first ? '' : '<button class="big ghost" data-act="home">Отмена</button>'}
      </div></div></div>`;
  }
  async function saveProfile() {
    const R = S.reg;
    const input = document.getElementById('reg-name');
    R.name = input ? input.value : R.name;
    const c = C.cleanName(R.name);
    if (!c.ok) { R.error = c.error; haptic('bad'); return render(); }
    const r = await api.profile(c.name, R.avatar);
    if (r.error) { R.error = r.message || 'Не получилось сохранить, попробуй ещё раз'; haptic('bad'); return render(); }
    S.player = r.player;
    S.top = null;
    haptic('ok');
    if (R.first) toast(`Привет, ${c.name}! Погнали 🐍`);
    // Новичку — вопрос «знаешь ли основы», если он ещё ничего не прошёл
    S.view = R.first ? 'langpick' : 'tabs'; // после знакомства — выбор языка программирования
    render();
  }

  function topbar() {
    const p = S.player;
    const hearts = p.plus || p.newbieDays ? '∞' : p.hearts;
    return `<div class="topbar">
      <div class="stat fire ${p.streakNow ? '' : 'off'}">🔥 ${p.streakNow}</div>
      <div class="stat xp">⭐ ${p.xp}${p.boost ? ` <span class="boost-badge" title="Бустер опыта">⚡x${p.boost.mult}</span>` : ''}</div>
      <button class="stat gem" data-tab="shop" data-shop-side="gems">💎 ${p.gems || 0}</button>
      <div class="stat heart">❤️ ${hearts}${p.plus ? ' <span class="plus-badge">PLUS</span>' : p.newbieDays ? ' <span class="plus-badge newbie">🐣</span>' : ''}</div>
    </div>`;
  }
  function tabs() {
    // Как в Duolingo: на телефоне — снизу, на компьютере — слева боковой панелью
    const q = S.player.quests, questReady = q && (q.list.some(x => x.done && !x.claimed) || (q.all.done && !q.all.claimed));
    const t = [['learn', '🏠', 'Обучение'], ['quests', '🎯', 'Задания'], ['top', '🏆', 'Рейтинг'], ['friends', '👥', 'Друзья'],
      ['shop', '🛒', 'Магазин'], ['me', '👤', 'Профиль'], ['more', '⚙️', 'Ещё']];
    return `<nav class="tabs"><div class="tabs-inner"><div class="side-logo">🐍 Питоша</div>${t.map(([id, ico, name]) =>
      `<button class="tab ${S.tab === id ? 'active' : ''}" data-tab="${id}"><span>${ico}${id === 'quests' && questReady ? '<i class="dot"></i>' : ''}</span><b>${name}</b></button>`).join('')}</div></nav>`;
  }

  // ---------- Дорожка уроков ----------
  const OFFSETS = [0, 70, 100, 70, 0, -70, -100, -70];
  function learnScreen() {
    const p = S.player;
    const current = LESSONS.findIndex((l, i) => !p.done[l.id] && C.isUnlocked(p, LESSONS, i));
    let html = `<div class="screen"><button class="lang-chip" data-act="langpick">${C.langInfo(LANG).ico} ${esc(langName())} <i>сменить ›</i></button>`;
    // Недоконченный урок — продолжить с того же вопроса
    const s = p.session && lessonById(p.session.lesson);
    if (s && p.session.i > 0 && p.session.i < s.questions.length) {
      html += `<button class="card banner resume" data-lesson="${s.id}"><span class="b-ico">${I('play')}</span>
        <span class="b-text"><b>Продолжить урок</b><small>«${esc(s.title)}» — вопрос ${p.session.i + 1} из ${s.questions.length}</small></span><span class="b-go">▶</span></button>`;
    }
    // Режим новичка: первые 7 дней жизни не тратятся
    if (p.newbieDays && !p.plus) {
      html += `<div class="card banner newbie"><span class="b-ico">🐣</span><span class="b-text"><b>Режим новичка</b>
        <small>Ещё ${p.newbieDays} ${days(p.newbieDays)} жизни не тратятся — ошибайся смело!</small></span></div>`;
    }
    // Ежедневный бонус: 7 дней по кругу
    if (p.daily) {
      const d = p.daily.day;
      html += `<div class="card banner daily"><span class="b-ico">🎁</span><span class="b-text"><b>Бонус за вход — день ${d}</b>
        <small>+${C.DAILY_XP[d - 1]} XP${d === 7 ? ' и 🧊 заморозка' : ''} · заходи каждый день, награда растёт</small>
        <span class="daily-dots">${C.DAILY_XP.map((_, k) => `<i class="${k < d - 1 ? 'got' : k === d - 1 ? 'now' : ''}"></i>`).join('')}</span></span>
        <button class="price" data-act="daily">Забрать</button></div>`;
    }
    for (const unit of UNITS) {
      html += `<div class="unit"><small>Раздел ${UNITS.indexOf(unit) + 1}</small><b>${esc(unit.title.replace(/^Раздел \d+\.\s*/, ''))}</b></div><div class="path">`;
      unit.lessons.forEach(l => {
        const i = lessonIndex(l.id);
        const done = !!p.done[l.id];
        const skipped = done && !!p.done[l.id].skipped; // пропущен по вступительному тесту — можно пройти
        const open = C.isUnlocked(p, LESSONS, i);
        const isCur = i === current;
        const cls = skipped ? 'done skipped' : done ? 'done' : !open ? 'locked' : 'open';
        const off = OFFSETS[i % OFFSETS.length];
        html += `<div class="node-wrap ${isCur ? 'current' : ''}" style="transform:translateX(${off}px)">
          ${isCur ? '<div class="start-bubble">СТАРТ</div>' : ''}
          <button class="node ${cls} ${isCur ? 'current' : ''}" data-lesson="${l.id}" ${open ? '' : 'aria-disabled="true"'}>${skipped ? I('skip') : done ? I('tick') : open ? I(l.questions.every(q => q.type === 'code') ? 'code' : 'star') : I('lock')}</button>
          <div class="node-title">${i + 1}. ${esc(l.title)}</div>
          ${isCur ? `<div class="path-mascot" style="${off >= 0 ? 'right' : 'left'}:${off >= 0 ? 120 : 120}px;top:-6px">${window.pitosha({ size: 96 })}</div>` : ''}
        </div>`;
      });
      html += '</div>';
    }
    html += `<div class="soon">🏆 В конце — итоговый экзамен. Пройдёшь все уроки — будешь знать основы ${esc(langName())}!</div></div>`;
    return html;
  }

  // ---------- Профиль ----------
  function meScreen() {
    const p = S.player;
    const lv = C.level(p.xp), inLv = C.levelProgress(p.xp);
    const doneCount = C.doneCount(p); // пропущенные вступительным тестом не считаем
    return `<div class="screen"><h2 class="title">Профиль</h2>
      <div class="card"><div class="profile-head"><div class="me-avatar">${avatarHtml((p.profile && p.profile.avatar) || '🐍')}</div><div style="flex:1"><b>${esc(p.name || 'Ученик')}</b> <button class="edit-btn" data-act="edit-profile">✏️</button>
        <div style="color:var(--muted);font-weight:800">Уровень ${lv} · ${inLv}/${C.XP_PER_LEVEL} XP</div>
        <div class="lvl-bar"><i style="width:${(inLv / C.XP_PER_LEVEL) * 100}%"></i></div></div></div></div>
      <button class="big ghost lang-btn" data-act="langpick">🌐 Язык: ${C.langInfo(LANG).ico} ${esc(langName())} — сменить</button>
      ${p.admin ? '<button class="big admin-btn" data-act="admin">📊 Админка — кто онлайн и все ученики</button>' : ''}
      <div class="grid2">
        <div class="tile"><b>🔥 ${p.streakNow}</b><small>серия, ${days(p.streakNow)}</small></div>
        <div class="tile"><b>🏅 ${p.bestStreak || 0}</b><small>рекорд серии</small></div>
        <div class="tile"><b>⭐ ${p.xp}</b><small>всего опыта</small></div>
        <div class="tile"><b>📚 ${doneCount}/${LESSONS.length}</b><small>уроков пройдено</small></div>
      </div>
      ${p.admin ? '<div class="card" style="margin-top:12px;border-color:var(--yellow)">🛠 <b>Режим создателя</b><br><span style="color:var(--muted);font-weight:700">Все уроки открыты, жизни бесконечные. В рейтинге тебя не видно — чтобы не мешать ученикам. Статистика — команда /stats в боте.</span></div>' : ''}
      ${p.plus && p.plusDays > 3650 ? '<div class="card plus-status"><div>👑 <b>Питоша Плюс</b><br><span>Навсегда</span></div></div>'
        : p.plus ? `<div class="card plus-status ${p.plusDays <= 3 ? 'ending' : ''}"><div>👑 <b>Питоша Плюс</b><br><span>${p.plusDays <= 3 ? '⏳ ' : ''}Закончится через ${p.plusDays} ${days(p.plusDays)} · до ${new Date(p.plusUntil).toLocaleDateString('ru-RU')}</span></div>
          <button class="price" data-act="renew">Продлить</button></div>`
        : p.newbieDays ? `<div class="card" style="margin-top:12px">🐣 <b>Режим новичка</b>: ещё ${p.newbieDays} ${days(p.newbieDays)} жизни не тратятся
          <button class="link-btn" data-act="renew">👑 Безлимит жизней и потом — с Плюсом</button></div>`
        : `<div class="card" style="margin-top:12px">❤️ ${p.hearts < C.MAX_HEARTS ? `Жизней: ${p.hearts}/${C.MAX_HEARTS}, новая через ${mins(p.nextHeartMs)}` : 'Все жизни на месте'}
          <button class="link-btn" data-act="renew">👑 Безлимит жизней с Плюсом</button></div>`}
      ${p.freezes ? `<div class="card">🧊 Заморозок серии: ${p.freezes}</div>` : ''}
      <h3 class="sub">🔥 Алмазы за серию</h3>${streakRewardCard()}
      <h3 class="sub">🏅 Ачивки · ${Object.keys(p.ach || {}).length}/${C.ACHIEVEMENTS.length}</h3>
      <div class="ach-grid">${C.ACHIEVEMENTS.map(a => { const got = p.ach && p.ach[a.id];
        return `<div class="ach ${got ? 'got' : ''}" title="${esc(a.desc)}"><span>${got ? a.ico : '🔒'}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></div>`; }).join('')}</div>
      <div class="grid2" style="margin-top:12px">
        <button class="tile tile-btn" data-act="sandbox"><b>🧪</b><small>Песочница</small></button>
        <button class="tile tile-btn" data-act="share"><b>📤</b><small>Поделиться успехами</small></button>
      </div>
    </div>`;
  }

  // ---------- Рейтинг ----------
  function topScreen() {
    const seg = '';
    if (!S.top) { api.top().then(r => { S.top = r.top || []; if (S.tab === 'top') render(); }); return `<div class="screen"><h2 class="title">Рейтинг</h2>${seg}<p class="note">Загружаю…</p></div>`; }
    const medals = ['🥇', '🥈', '🥉'];
    return `<div class="screen"><h2 class="title">Рейтинг</h2>${seg}<div class="card">${S.top.length ? S.top.map((u, i) =>
      `<div class="row ${u.me ? 'me' : ''}"><div class="place">${medals[i] || u.place || i + 1}</div><div class="row-av">${avatarHtml(u.avatar || '🐍')}</div><div class="who">${esc(u.name)}${u.me ? ' (ты)' : ''}</div><div class="pts">${u.xp} XP</div></div>`).join('')
      : '<p class="note">Пока пусто — пройди урок и стань первым!</p>'}</div>
      <p class="note">Опыт дают за уроки. Без ошибок — бонус!</p></div>`;
  }

  // ---------- Магазин ----------
  const PLANS = [
    { id: 'plus_week', name: 'Неделя', price: C.SHOP.plus_week.stars, sub: '7 дней' },
    { id: 'plus', name: 'Месяц', price: C.SHOP.plus.stars, sub: '30 дней', tag: 'Популярный' },
    { id: 'plus_year', name: 'Год', price: C.SHOP.plus_year.stars, sub: '≈ 42 ⭐ в месяц', tag: 'Выгодно −45%' },
  ];
  const ITEMS = [
    { id: 'hearts', ico: '❤️', name: 'Все жизни сразу', desc: 'Не ждать восстановления', price: C.SHOP.hearts.stars },
    { id: 'freeze', ico: '🧊', name: 'Заморозка серии', desc: 'Пропустишь день — серия не сгорит', price: C.SHOP.freeze.stars },
  ];
  function shopScreen() {
    const p = S.player, promo = S.promo;
    const seg = `<div class="seg"><button class="${S.shopSide !== 'gems' ? 'on' : ''}" data-shop-side="stars">⭐ За звёзды</button><button class="${S.shopSide === 'gems' ? 'on' : ''}" data-shop-side="gems">💎 Бесплатно</button></div>`;
    if (S.shopSide === 'gems') {
      return `<div class="screen"><h2 class="title">Магазин</h2>${seg}
        <div class="card gem-balance"><span>💎</span><div><b>${p.gems || 0} алмазов</b><small>1–10 за каждый урок, сундуки за задания и забеги, алмазы за каждые 10 дней серии</small></div></div>
        ${Object.entries(C.GEM_SHOP).map(([id, it]) => `<div class="card shop-item"><div class="ico">${it.title.split(' ')[0]}</div>
          <div class="info"><b>${esc(it.title.slice(it.title.indexOf(' ') + 1))}</b><small>${esc(it.description)}</small></div>
          <button class="price gem-price" data-gem-buy="${id}" ${(p.gems || 0) < it.gems ? 'disabled' : ''}>${it.gems} 💎</button></div>`).join('')}
        <p class="note">Алмазы нельзя купить — только заработать учёбой 💪</p></div>`;
    }
    return `<div class="screen"><h2 class="title">Магазин</h2>${seg}
      <div class="card plus-card"><div class="plus-head">👑 <b>Питоша Плюс</b>${p.plus ? `<span class="plus-left">${p.plusDays > 3650 ? 'навсегда' : `ещё ${p.plusDays} ${days(p.plusDays)}`}</span>` : ''}</div>
        <ul class="perks"><li>❤️ Безлимитные жизни — учись сколько хочешь</li><li>🎨 Эксклюзивные темы оформления</li></ul>
        ${promo && promo.available ? `<button class="promo" data-buy="plus_promo"><b>🎁 Акция для первых 100: месяц за ${C.SHOP.plus_promo.stars} ⭐</b><small>Осталось мест: ${promo.left}</small></button>` : ''}
        <div class="plans">${PLANS.map(pl => `<button class="plan ${pl.tag ? 'hot' : ''}" data-buy="${pl.id}">${pl.tag ? `<i>${pl.tag}</i>` : ''}<b>${pl.name}</b><span>${pl.price} ⭐</span><small>${pl.sub}</small></button>`).join('')}</div>
        ${p.plus ? '<p class="note">Новая покупка добавит дни к текущему Плюсу</p>' : ''}</div>
      ${ITEMS.map(it => `<div class="card shop-item"><div class="ico">${it.ico}</div><div class="info"><b>${it.name}</b><small>${it.desc}</small></div>
        <button class="price" data-buy="${it.id}">${it.price} ⭐</button></div>`).join('')}
      <p class="note">Оплата звёздами Telegram ⭐ · Все уроки бесплатны — Плюс просто делает учёбу удобнее</p></div>`;
  }
  async function buy(id) {
    haptic();
    const r = await api.buy(id);
    if (r.error === 'demo') return toast('В демо-режиме оплаты нет — заработает в Telegram');
    if (r.error === 'promo_over') { toast('Акция закончилась 😔 Но обычные тарифы работают!'); S.promo = { left: 0, available: false }; return render(); }
    if (r.error || !r.invoiceUrl) return toast('Не получилось открыть оплату, попробуй позже');
    tg.openInvoice(r.invoiceUrl, async status => {
      if (status === 'paid') { haptic('ok'); toast('Спасибо! Покупка получена 🎉'); setTimeout(load, 1500); }
    });
  }

  async function gemBuy(item) {
    haptic();
    const r = await api.gemBuy(item);
    if (r.player) S.player = r.player;
    if (r.error === 'no_gems') toast('Не хватает алмазов 💎 Проходи уроки и открывай сундуки!');
    else if (r.error === 'full') toast('Все жизни и так на месте ❤️');
    else if (r.error) toast('Не получилось, попробуй ещё раз');
    else { haptic('ok'); toast(item === 'heart' ? '❤️ +1 жизнь!' : '🧊 Заморозка серии добавлена!'); }
    render();
  }

  // ---------- Сундуки: 4 редкости, как в Duolingo ----------
  const CHEST_NAME = { common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' };
  const chestIco = kind => I({ common: 'chest_c', rare: 'chest_r', epic: 'chest_e', legendary: 'chest_l' }[kind] || 'chest_c');
  // Открытие сундука: трясётся → открывается → редкость и алмазы
  function showChest(got, title) {
    haptic('ok');
    const box = document.createElement('div');
    box.className = 'chest-pop ' + got.chest;
    box.innerHTML = svgify(`<div class="cp-card"><div class="cp-title">${esc(title || 'Сундук')}</div>
      <div class="cp-chest shake">${chestIco(got.chest)}</div>
      <div class="cp-reveal"><div class="cp-rarity">${CHEST_NAME[got.chest] || ''}</div><div class="cp-gems">+${got.gems} 💎</div>${got.boost ? `<div class="cp-boost">⚡ Бустер опыта x${got.boost} на ${C.BOOST_MIN} минут!</div>` : ''}</div>
      <button class="big">Забрать</button></div>`);
    document.body.appendChild(box);
    setTimeout(() => { box.classList.add('opened'); if (got.chest === 'epic' || got.chest === 'legendary') celebrate(); }, 900);
    box.addEventListener('click', () => box.remove());
  }

  // ---------- Алмазы за серию: каждые 10 дней огонька ----------
  function streakRewardCard() {
    const sr = S.player.streakReward;
    if (!sr) return '';
    const from = sr.next - C.STREAK_STEP, have = Math.max(0, sr.streak - from);
    const marks = [0, 1, 2, 3].map(k => sr.next + k * C.STREAK_STEP);
    return `<div class="card streak-reward"><div class="sc-ico">${I('gem')}</div>
      <div class="sc-body"><b>🔥 ${sr.streak} → ${sr.next} ${days(sr.next)}</b><small>Награда: ${sr.nextGems} 💎 · каждые ${C.STREAK_STEP} дней огонька</small>
        <div class="q-bar"><i style="width:${(have / C.STREAK_STEP) * 100}%"></i><span>${have} / ${C.STREAK_STEP}</span></div>
        <div class="sc-marks">${marks.map(m => `<span>🔥<em>${m}</em> → ${Math.min(500, m * 5)} 💎</span>`).join('')}</div></div></div>`;
  }

  // ---------- Задания на день → сундуки ----------
  function questsScreen() {
    const st = S.player.quests;
    if (!st) return '<div class="screen"><h2 class="title">Задания</h2><p class="note">Загружаю…</p></div>';
    const chestBtn = (id, done, claimed, kind) => claimed ? `<span class="chest open">${I('chest_open')}</span>`
      : done ? `<button class="chest ready" data-quest="${id}"><span class="shake">${chestIco(kind)}</span><small>Открыть</small></button>` : `<span class="chest locked">${chestIco(kind)}</span>`;
    return `<div class="screen"><h2 class="title">Задания на сегодня</h2>
      <p class="note" style="text-align:left;margin:-8px 0 12px">Новые задания — каждый день в полночь. За каждое — сундук: обычный, эпический и легендарный. Любой, кроме легендарного, с шансом 25% станет лучше! ✨</p>
      ${streakRewardCard()}
      ${st.list.map(q => `<div class="card quest ${q.done ? 'done' : ''}"><span class="q-ico">${q.ico}</span>
        <div class="q-body"><b>${esc(q.title)}</b><div class="q-bar"><i style="width:${(q.have / q.target) * 100}%"></i><span>${q.have} / ${q.target}</span></div>
        <small class="rarity ${q.chest}">${CHEST_NAME[q.chest]} сундук</small></div>
        ${chestBtn(q.id, q.done, q.claimed, q.chest)}</div>`).join('')}
      <div class="card quest final ${st.all.done ? 'done' : ''}"><span class="q-ico">🏆</span><div class="q-body"><b>Выполни все 3 задания</b>
        <small class="rarity epic">Эпический сундук — может стать легендарным!</small></div>${chestBtn('all', st.all.done, st.all.claimed, 'epic')}</div>
      <div class="card chest-legend">${C.RARITIES.map(k => `<span>${chestIco(k)}<b class="rarity ${k}">${CHEST_NAME[k]}</b><small>${C.CHESTS[k].gems[0]}–${C.CHESTS[k].gems[1]} 💎</small></span>`).join('')}</div></div>`;
  }
  async function claimQuestChest(id) {
    haptic();
    const r = await api.questClaim(id);
    if (r.player) S.player = r.player;
    render();
    if (r.chest) showChest(r.chest, id === 'all' ? 'Большой сундук' : 'Сундук за задание');
  }

  // ---------- Друзья (как в Duolingo): поиск по нику, подписка, взаимная подписка = друзья ----------
  const loadFriends = () => api.friends().then(r => { S.fr = r.error ? { friends: [], requests: [], sent: [], streaks: [] } : r; if (r.player) S.player = r.player; if (S.tab === 'friends') render(); });
  const relBtn = p => {
    if (p.relation === 'friend') return '<span class="tag-ok">Друзья ✓</span>';
    if (p.relation === 'following') return '<span class="tag-wait">Ждём ответа</span>';
    return `<button class="price small" data-follow="${p.id}">${p.relation === 'follower' ? 'Подписаться в ответ' : 'Подписаться'}</button>`;
  };
  const personRow = (p, right) => `<div class="row"><div class="row-av">${avatarHtml(p.avatar)}</div>
    <div class="who">${esc(p.name)}<small class="sub-line">${p.username ? '@' + esc(p.username) + ' · ' : ''}⭐ ${p.xp} XP${p.streak ? ' · 🔥 ' + p.streak : ''}</small></div>${right}</div>`;
  function streakCard(s) {
    const f = s.friend;
    if (s.status === 'pending') {
      return `<div class="card fstreak pending"><div class="race-head">${avatarHtml(f.avatar)}<b>${esc(f.name)}</b>
        <small>${s.invitedByMe ? 'ждём, когда друг примет' : 'зовёт тебя в забег!'}</small></div>
        ${s.invitedByMe ? `<button class="big ghost" data-send="${s.id}">Отменить приглашение</button>`
          : `<div class="two-btn"><button class="big green" data-saccept="${s.id}">Принять</button><button class="big ghost" data-sdecline="${s.id}">Отказаться</button></div>`}</div>`;
    }
    const both = s.meToday && s.friendToday;
    return `<div class="card fstreak ${both ? 'done' : ''}"><div class="race-head">${avatarHtml(f.avatar)}<b>Ты и ${esc(f.name)}</b>
        <span class="fs-days">🔥 ${s.days} ${days(s.days)}</span><button class="x-btn" data-send="${s.id}" aria-label="Закончить забег">✕</button></div>
      <div class="fs-today"><span class="${s.meToday ? 'ok' : ''}">${s.meToday ? '✅' : '⏳'} Ты</span><span class="${s.friendToday ? 'ok' : ''}">${s.friendToday ? '✅' : '⏳'} ${esc(f.name)}</span>
        <small>${both ? 'Сегодня забег продлён!' : 'Чтобы продлить, каждому нужно пройти хотя бы 1 урок сегодня'}</small></div>
      ${s.reward ? `<button class="big green chest-btn" data-sclaim="${s.id}"><span class="shake">${chestIco(s.reward.chest)}</span> Открыть сундук за ${s.reward.n} ${days(s.reward.n)}</button>`
        : s.next ? `<small class="fs-next">До сундука: ${s.next - s.days} ${days(s.next - s.days)} (рубеж ${s.next})</small>` : ''}</div>`;
  }
  function friendsScreen() {
    if (!S.fr) { loadFriends(); return '<div class="screen"><h2 class="title">Друзья</h2><p class="note">Загружаю…</p></div>'; }
    const F = S.fr, inStreak = new Set(F.streaks.map(s => s.friend.id)), full = F.streaks.length >= C.FSTREAK_MAX;
    return `<div class="screen"><h2 class="title">Друзья</h2>
      <div class="card add-friend"><b>🔎 Найди друга</b><small>По имени в Питоше или по @нику в Telegram. Подпишись — и когда он подпишется в ответ, вы станете друзьями.</small>
        <form id="friend-form" class="friend-row"><input class="answer-input" id="friend-q" maxlength="32" autocomplete="off" placeholder="Имя или @ник" value="${esc(S.frq || '')}"><button type="button" class="price" data-act="friend-search">Найти</button></form>
        ${S.frs ? (S.frs.length ? `<div class="search-res">${S.frs.map(p => personRow(p, relBtn(p))).join('')}</div>` : '<p class="note">Никого не нашли 🤔 Проверь имя или позови друга по ссылке ниже.</p>') : ''}</div>
      ${F.requests.length ? `<h3 class="sub">👋 Подписались на тебя · ${F.requests.length}</h3><div class="card">${F.requests.map(p => personRow(p, relBtn({ ...p, relation: 'follower' }))).join('')}</div>` : ''}
      <h3 class="sub">🏁 Дружеские забеги · ${F.streaks.length}/${C.FSTREAK_MAX}</h3>
      ${F.streaks.length ? F.streaks.map(streakCard).join('') : '<p class="note">Позови друга в забег: каждый день, когда вы оба проходите хотя бы 1 урок, забег растёт. За 3, 7, 14, 30 дней — сундуки обоим!</p>'}
      <h3 class="sub">👥 Мои друзья · ${F.friends.length}</h3>
      ${F.friends.length ? `<div class="card">${F.friends.map(p => personRow(p, `<button class="price small" data-sinvite="${p.id}" ${inStreak.has(p.id) || full ? 'disabled' : ''}>${inStreak.has(p.id) ? 'В забеге' : '🏁 Забег'}</button>
        <button class="x-btn" data-unfollow="${p.id}" aria-label="Удалить из друзей">✕</button>`)).join('')}</div>`
        : '<p class="note">Пока никого. Найди друга по нику выше или пригласи по ссылке.</p>'}
      ${F.sent.length ? `<h3 class="sub">⏳ Ты подписан, ждём ответа</h3><div class="card">${F.sent.map(p => personRow(p, `<button class="x-btn" data-unfollow="${p.id}" aria-label="Отписаться">✕</button>`)).join('')}</div>` : ''}
      <div class="card invite"><b>🎁 Пригласи друга — 1 день Плюса за каждого</b>
        <small>Отправь другу свою ссылку. Просто перейти по ней мало: когда друг позанимается ${C.REF_DAYS} дня, тебе — 1 день Питоша Плюс. Звать можно сколько угодно друзей!${F.refRewards ? ` Уже получено: ${F.refRewards} 👑` : ''}</small>
        <button class="big" data-act="invite">📨 Пригласить друга</button></div></div>`;
  }
  async function searchFriends() {
    const inp = document.getElementById('friend-q');
    S.frq = inp ? inp.value.trim() : '';
    if (S.frq.replace(/^@/, '').length < 2) return toast('Напиши хотя бы 2 буквы имени или @ник');
    const r = await api.friendSearch(S.frq);
    S.frs = r.list || [];
    render();
  }
  async function frAction(call, okMsg) {
    haptic();
    const r = await call();
    const msg = { not_found: 'Ученик не найден', not_friend: 'Забег можно начать только с другом', already: 'С этим другом уже есть забег',
      max: `Можно не больше ${C.FSTREAK_MAX} забегов`, friend_max: `У друга уже ${C.FSTREAK_MAX} забегов`, claimed: 'Этот сундук уже открыт' }[r.error];
    if (r.friends) S.fr = r;
    if (r.player) S.player = r.player;
    if (r.error) { haptic('bad'); toast(msg || 'Не получилось, попробуй ещё раз'); }
    else if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    if (S.frs && r.friends) { const rel = new Map([...r.friends.map(p => [p.id, 'friend']), ...r.sent.map(p => [p.id, 'following']), ...r.requests.map(p => [p.id, 'follower'])]); S.frs = S.frs.map(p => ({ ...p, relation: rel.get(p.id) || 'none' })); }
    render();
    return r;
  }
  function confirmThen(text, go) { if (tg && tg.showConfirm) tg.showConfirm(text, ok => { if (ok) go(); }); else if (confirm(text)) go(); }

  // ---------- Ещё: настройки ----------
  function moreScreen() {
    const vibro = store.get('pitosha-vibro') !== 'off';
    return `<div class="screen"><h2 class="title">Ещё</h2>
      <h3 class="sub">🎨 Тема</h3>
      <div class="themes">${THEMES.map(t => `<button class="theme-btn ${document.documentElement.dataset.theme === t.id ? 'sel' : ''}" data-theme="${t.id}"><span>${t.ico}</span>${t.name}${t.plus && !canPlus() ? ' 👑' : ''}</button>`).join('')}</div>
      <h3 class="sub">⚙️ Настройки</h3>
      <div class="card menu">
        <button class="menu-row" data-act="vibro"><span>📳 Вибрация</span><i class="switch ${vibro ? 'on' : ''}"></i></button>
        <button class="menu-row" data-act="sandbox"><span>🧪 Песочница</span><i>›</i></button>
        <button class="menu-row" data-act="invite"><span>📨 Пригласить друга</span><i>›</i></button>
        <button class="menu-row" data-act="share"><span>📤 Поделиться успехами</span><i>›</i></button>
        <button class="menu-row" data-act="edit-profile"><span>✏️ Имя и аватарка</span><i>›</i></button>
      </div>
      <p class="note">Проблема с покупкой? Напиши боту /paysupport</p>
      ${api.demo ? '<p class="note">Демо-режим: прогресс хранится в этом браузере.</p><button class="big ghost" data-act="reset">Сбросить прогресс</button>' : ''}</div>`;
  }

  // ---------- Админка (только для создателя) ----------
  function openAdmin() { S.view = 'admin'; S.adm = null; render(); api.admin().then(r => { S.adm = r; if (S.view === 'admin') render(); }); }
  function agoText(iso) {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 5) return '🟢 онлайн';
    if (m < 60) return `${m} мин назад`;
    if (m < 1440) return `${Math.floor(m / 60)} ч назад`;
    const d = Math.floor(m / 1440); return `${d} ${days(d)} назад`;
  }
  function adminScreen() {
    const A = S.adm;
    if (!A) return '<div class="screen" style="padding-top:14px"><h2 class="title">📊 Админка</h2><p class="note">Загружаю…</p></div>';
    if (A.error) return '<div class="screen" style="padding-top:14px"><h2 class="title">📊 Админка</h2><p class="note">Нет доступа</p><button class="big ghost" data-act="home">Назад</button></div>';
    const user = p => p.username ? `<a class="adm-user" href="https://t.me/${esc(p.username)}" target="_blank">@${esc(p.username)}</a>` : '<span class="adm-nouser">без юзернейма</span>';
    return `<div class="screen" style="padding-top:14px"><h2 class="title">📊 Админка</h2>
      <div class="grid2"><div class="tile"><b>🟢 ${A.online}</b><small>онлайн сейчас (5 мин)</small></div><div class="tile"><b>🔥 ${A.activeToday}</b><small>заходили сегодня</small></div>
        <div class="tile"><b>🆕 ${A.newToday}</b><small>новых сегодня</small></div><div class="tile"><b>👥 ${A.total}</b><small>всего учеников</small></div></div>
      <button class="big ghost" data-act="admin" style="margin:12px 0">🔄 Обновить</button>
      <div class="card">${A.players.length ? A.players.map(p => `<div class="row adm-row"><div class="row-av">${avatarHtml(p.avatar)}</div>
        <div class="who">${esc(p.name)} ${user(p)}<small class="sub-line">⭐ ${p.xp} XP${p.streak ? ' · 🔥 ' + p.streak : ''} · ${esc(p.source)} · ${agoText(p.seen)}</small></div></div>`).join('') : '<p class="note">Пока учеников нет</p>'}</div>
      <p class="note">Ты в списке не показан. «Онлайн» — кто открывал Питошу за последние 5 минут.</p>
      <button class="big ghost" data-act="home">Назад</button></div>`;
  }

  // ---------- Выбор языка программирования ----------
  function langPickScreen() {
    return `<div class="screen" style="padding-top:14px"><h2 class="title">Какой язык будешь учить?</h2>
      <p class="note" style="text-align:left;margin-top:-8px">Опыт, огонёк, алмазы и Плюс — общие для всех языков. Сменить язык можно в любой момент в профиле, прогресс сохранится.</p>
      <div class="lang-grid">${C.LANGS.map(l => `<button class="card lang-card ${S.player.lang === l.id ? 'sel' : ''}" data-lang="${l.id}">
        <span class="lang-ico">${l.ico}</span><b>${esc(l.name)}</b><small>${esc(l.about)}</small>${l.sandbox ? '<i class="lang-tag">🧪 есть песочница</i>' : ''}</button>`).join('')}</div>
      ${S.player.lang ? '<button class="big ghost" data-act="home" style="margin-top:14px">Назад</button>' : ''}</div>`;
  }
  async function chooseLang(lang) {
    haptic();
    const r = await api.setLang(lang);
    if (r.player) S.player = r.player;
    await loadLang(lang);
    S.view = 'tabs'; S.tab = 'learn'; S.sandbox = null;
    toast(`${C.langInfo(LANG).ico} Учим ${C.langInfo(LANG).name}!`);
    render(); window.scrollTo(0, 0);
  }

  // ---------- Песочница (бесплатно): Python, JavaScript, HTML/CSS и Lua ----------
  const SB_LANGS = ['python', 'js', 'html', 'lua'];
  const SB_START = {
    python: 'name = input("Как тебя зовут? ")\nprint(f"Привет, {name}! 🐍")\n',
    js: 'let name = prompt("Как тебя зовут?");\nconsole.log(`Привет, ${name}! ⚡`);\n',
    html: '<style>\n  body { font-family: sans-serif; background: #0d1f3c; color: white; text-align: center; }\n  h1 { color: #ffd43b; }\n</style>\n<h1>Мой сайт</h1>\n<p>Я учу HTML и CSS в Питоше!</p>\n',
    lua: 'local name = io.read()\nprint("Привет, " .. name .. "! 🎮")\nfor i = 1, 3 do\n  print("Уровень " .. i)\nend\n',
  };
  const SB_NOTE = {
    python: 'Настоящий Python прямо в телефоне. Нужна библиотека? Напиши <code>import</code> или строку <code>pip install имя</code> — Питоша скачает её сам.',
    js: 'Настоящий JavaScript. Вывод — <code>console.log()</code>, ввод — <code>prompt()</code> (берёт строки из поля «Ввод»).',
    html: 'Пиши HTML и CSS — страница появится прямо здесь. Можно добавить и <code>&lt;script&gt;</code> с JavaScript.',
    lua: 'Lua — основа Luau из Roblox. Вывод — <code>print()</code>, ввод — <code>io.read()</code>. Объектов Roblox (workspace, Instance) здесь нет — они работают только в Roblox Studio.',
  };
  const sbKey = lang => (lang === 'python' ? 'pitosha-sandbox' : 'pitosha-sandbox-' + lang);
  const htmlPreview = code => `<iframe class="html-preview" sandbox="allow-scripts" srcdoc="${esc(code)}"></iframe>`;
  function newSandbox(lang) {
    return { lang, code: store.get(sbKey(lang)) || SB_START[lang], stdin: lang === 'html' ? '' : (lang === 'lua' || lang === 'js' || lang === 'python' ? 'Питоша' : ''), out: '', running: false };
  }
  function openSandbox() {
    if (!S.sandbox) S.sandbox = newSandbox(SB_LANGS.includes(LANG) ? LANG : 'python');
    S.view = 'sandbox';
    window.RUN.preload(S.sandbox.lang);
    render();
  }
  function switchSandbox(lang) {
    const ed = document.getElementById('sb-editor');
    if (ed && S.sandbox) store.set(sbKey(S.sandbox.lang), ed.value);
    S.sandbox = newSandbox(lang);
    window.RUN.preload(lang);
    haptic(); render();
  }
  function sandboxScreen() {
    const B = S.sandbox, info = C.langInfo(B.lang);
    return `<div class="screen" style="padding-top:14px"><h2 class="title">🧪 Песочница</h2>
      <div class="sb-langs">${SB_LANGS.map(l => `<button class="${l === B.lang ? 'on' : ''}" data-sblang="${l}">${C.langInfo(l).ico} ${esc(C.langInfo(l).name)}</button>`).join('')}</div>
      <p class="note" style="text-align:left;margin-top:-2px">${SB_NOTE[B.lang]} Код сохраняется сам.</p>
      <textarea class="editor" id="sb-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off">${esc(B.code)}</textarea>
      ${B.lang === 'html' ? '' : `<label class="stdin-label">⌨️ Ввод (каждое значение с новой строки):</label>
      <textarea class="stdin" id="sb-stdin" spellcheck="false" rows="2">${esc(B.stdin)}</textarea>`}
      <div class="code-tools"><button class="tool" data-act="sb-run">${B.running ? '⏳ Запуск…' : (B.lang === 'html' ? '▶️ Показать страницу' : '▶️ Запустить')}</button>
        <button class="tool" data-act="sb-save">💾 Сохранить и поделиться</button></div>
      ${B.out ? `<div class="console">${B.out}</div>` : ''}
      <h3 class="sub">📂 Мои программы</h3>${snippetList()}
      <button class="big ghost" data-act="home">На главную</button></div>`.replace('${info}', info.name);
  }
  function snippetList() {
    if (!S.snips) { api.snippets().then(r => { S.snips = r.list || []; if (S.view === 'sandbox') render(); }); return '<p class="note">Загружаю…</p>'; }
    if (!S.snips.length) return '<p class="note">Пока пусто. Нажми «Сохранить» — программа появится здесь, а ссылкой можно поделиться с друзьями.</p>';
    return `<div class="card">${S.snips.map(s => `<div class="row"><code class="snip-prev">${C.langInfo(s.lang).ico} ${esc(s.preview || '(пусто)')}</code>
      <button class="price small" data-snip="${esc(s.id)}">Открыть</button><button class="price small" data-snip-share="${esc(s.link)}">📤</button></div>`).join('')}</div>`;
  }
  async function saveSnippet() {
    const B = S.sandbox, ed = document.getElementById('sb-editor');
    if (ed) B.code = ed.value;
    if (!B.code.trim()) return toast('Сначала напиши код ✍️');
    const r = await api.snippetSave(B.code, B.lang);
    if (r.error) return toast({ limit: 'Слишком много сохранений за сутки', too_long: 'Слишком длинная программа' }[r.error] || 'Не получилось сохранить');
    haptic('ok'); S.snips = null;
    toast('💾 Сохранено! Отправь ссылку другу');
    render();
    shareLink(r.link, `Посмотри мою программу на ${C.langInfo(B.lang).name} ${C.langInfo(B.lang).ico} Её можно запустить прямо в Telegram!`);
  }
  // Чужой (или свой) сохранённый код по ссылке: посмотреть и запустить может любой
  async function openSnippet(id) {
    const r = await api.snippetGet(id);
    if (r.error) return toast('Этот код не найден 😔');
    S.snip = { id: r.id, code: r.code, lang: C.cleanLang(r.lang), author: r.author, mine: r.mine, stdin: '', out: '', running: false };
    S.view = 'snippet';
    window.RUN.preload(S.snip.lang);
    render(); window.scrollTo(0, 0);
  }
  function snippetScreen() {
    const N = S.snip, info = C.langInfo(N.lang);
    return `<div class="screen" style="padding-top:14px"><h2 class="title">${info.ico} Программа на ${esc(info.name)}</h2>
      <p class="note" style="text-align:left;margin-top:-8px">Автор: ${esc(N.author)}</p>
      <pre class="code">${highlight(N.code)}</pre>
      ${N.lang === 'html' ? '' : `<label class="stdin-label">⌨️ Ввод (каждое значение с новой строки):</label>
      <textarea class="stdin" id="snip-stdin" spellcheck="false" rows="2">${esc(N.stdin)}</textarea>`}
      <div class="code-tools"><button class="tool" data-act="snip-run">${N.running ? '⏳ Запуск…' : '▶️ Запустить'}</button>
        <button class="tool" data-act="snip-to-sandbox">🧪 В песочницу</button>
        <button class="tool" data-snip-share="https://t.me/pythonshkabot?start=code_${esc(N.id)}">📤</button></div>
      ${N.out ? `<div class="console">${N.out}</div>` : ''}
      <button class="big ghost" data-act="home">На главную</button></div>`;
  }
  // Запуск в песочнице или по ссылке: один и тот же путь для всех языков
  async function runAny(B, stdinId) {
    if (B.running) return;
    const si = document.getElementById(stdinId); if (si) B.stdin = si.value;
    if (B.lang === 'html') { B.out = `<div class="console-title">Твоя страница:</div>${htmlPreview(B.code)}`; return render(); }
    const wasCold = !window.RUN.isWarm(B.lang);
    B.running = true; B.out = wasCold ? `⏳ Загружаю ${B.lang === 'lua' ? 'Lua' : 'Python'} (только в первый раз, ~10 секунд)…` : ''; render();
    let r;
    if (B.lang === 'python') {
      const libs = /^\s*[!%]?\s*pip3?\s+install|^\s*(import|from)\s/m.test(B.code);
      if (libs) { B.out = (B.out ? B.out + '<br>' : '') + '📦 Проверяю и ставлю библиотеки — первый раз это может занять до минуты…'; render(); }
      r = await window.RUN.run('python', B.code, [{ run: true, stdin: B.stdin }], libs ? 120000 : 20000, { sandbox: true });
    } else {
      r = await window.RUN.run(B.lang, B.code, [{ run: true, stdin: B.stdin }], wasCold ? 60000 : 10000);
    }
    B.running = false;
    if (r.error) B.out = r.error === 'timeout' ? '⏱ Программа работает слишком долго. Может быть, бесконечный цикл?' : '⚠️ ' + esc(r.error);
    else {
      const t = r.results[0];
      // tkinter, pygame и т.п.: это не ошибка ученика — в телефоне просто нет окон. Объясняем по-доброму.
      const desk = r.desktop || [], deskErr = desk.length && t.err && /^ModuleNotFoundError/.test(t.err);
      B.out = (r.log && r.log.length ? `<div class="console-log">${r.log.map(esc).join('<br>')}</div>` : '') +
        (desk.length ? `<div class="console-info">💻 ${esc(desk.join(', '))} — это для компьютера: в телефоне нет окон, клавиатуры и звука Windows. Такой код заработает, если скачать Python на компьютер (python.org). А здесь пиши программы с <code>print()</code> и <code>input()</code> — им всё доступно!</div>` : '') +
        (deskErr ? '' : `<div class="console-title">Вывод программы:</div><pre>${esc(t.printed || '(ничего не напечатано)')}</pre>` +
        (t.err ? `<div class="console-err">❌ ${esc(t.err)}</div>${B.lang === 'python' ? tipHtml(explainError(t.err)) : ''}` : ''));
    }
    render();
  }
  function runSnippet() { return runAny(S.snip, 'snip-stdin'); }
  function runSandbox() {
    const ed = document.getElementById('sb-editor');
    if (ed) { S.sandbox.code = ed.value; store.set(sbKey(S.sandbox.lang), ed.value); }
    return runAny(S.sandbox, 'sb-stdin');
  }

  // ---------- Поделиться результатом: картинка с прогрессом ----------
  function shareCanvas() {
    const p = S.player, f = S.view === 'finish' ? S.finish : null;
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1080;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 1080, 1080); bg.addColorStop(0, '#13294d'); bg.addColorStop(1, '#2b5f99');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1080);
    g.textAlign = 'center'; g.fillStyle = '#ffd43b';
    g.font = '900 96px Nunito, sans-serif'; g.fillText('🐍 Питоша', 540, 190);
    g.fillStyle = '#f2f6ff'; g.font = '800 54px Nunito, sans-serif';
    g.fillText(f ? `Прошёл урок «${f.title.slice(0, 26)}»` : `${p.name || 'Ученик'} учит ${langName()}`, 540, 300);
    const stats = [['⭐', `${p.xp} XP`, `уровень ${C.level(p.xp)}`], ['🔥', `${p.streakNow}`, `${days(p.streakNow)} подряд`], ['📚', `${C.doneCount(p)}`, 'уроков'], ['🏅', `${Object.keys(p.ach || {}).length}`, 'ачивок']];
    stats.forEach(([ico, big, small], k) => {
      const x = 150 + (k % 2) * 400, y = 380 + Math.floor(k / 2) * 250;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      if (g.roundRect) { g.beginPath(); g.roundRect(x, y, 380, 220, 36); g.fill(); } else g.fillRect(x, y, 380, 220); // старые телефоны
      g.fillStyle = '#ffd43b'; g.font = '900 84px Nunito, sans-serif'; g.fillText(`${ico} ${big}`, x + 190, y + 115);
      g.fillStyle = '#9fb3d6'; g.font = '800 40px Nunito, sans-serif'; g.fillText(small, x + 190, y + 180);
    });
    g.fillStyle = '#f2f6ff'; g.font = '800 46px Nunito, sans-serif'; g.fillText('Учи программирование в Telegram', 540, 940);
    g.fillStyle = '#ffd43b'; g.font = '900 52px Nunito, sans-serif'; g.fillText('@pythonshkabot', 540, 1010);
    return cv;
  }
  async function shareResult() {
    haptic();
    const p = S.player;
    const text = `Я учу ${langName()} в Питоше ${C.langInfo(LANG).ico} Уже ${C.doneCount(p)} уроков, уровень ${C.level(p.xp)}, серия ${p.streakNow} 🔥 Присоединяйся!`;
    const link = 'https://t.me/pythonshkabot';
    try {
      const blob = await new Promise(ok => shareCanvas().toBlob(ok, 'image/jpeg', 0.9));
      const file = blob && new File([blob], 'pitosha.jpg', { type: 'image/jpeg' });
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: text + ' ' + link });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; /* отменил — ничего не делаем */ }
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
  }

  // ---------- Урок ----------
  async function openLesson(id) {
    haptic();
    const i = lessonIndex(id);
    if (!C.isUnlocked(S.player, LESSONS, i)) return toast('🔒 Сначала пройди предыдущий урок');
    const r = await api.start(id);
    if (r.player) S.player = r.player;
    if (r.error === 'no_hearts') { S.view = 'nohearts'; return render(); }
    if (r.error) return toast('Не получилось начать урок');
    S.L = { id, lesson: lessonById(id), i: 0, order: null, sel: null, text: '', checked: null, correct: 0 };
    if (r.resume) { S.L.i = r.resume.i; S.L.correct = r.resume.correct || 0; toast(`Продолжаем с вопроса ${r.resume.i + 1} 👌`); }
    if (S.L.lesson.questions.some(q => q.type === 'code')) window.RUN.preload(LANG); // качаем движок языка заранее
    newQuestion();
    S.view = 'lesson';
    render();
  }
  function newQuestion() {
    const L = S.L;
    const q = L.lesson.questions[L.i];
    L.sel = null; L.text = ''; L.checked = null;
    L.order = q.options ? shuffle(q.options.map((_, k) => k)) : null;
    if (q.type === 'code') {
      // Черновик: если закрыл приложение посреди задачи, код не пропадёт
      L.draftKey = `pitosha-draft-${L.id}-${L.i}`;
      L.code = store.get(L.draftKey) || q.starter || '';
      L.out = ''; L.hint = false; L.tries = 0; L.running = false;
      L.stdin = ((q.tests || []).find(t => t.stdin) || {}).stdin || '';
    }
  }

  // ---------- Практика: пишем код ----------
  function codeBlock(q, L) {
    let html = `<div class="task">${q.task}</div>`;
    html += `<textarea class="editor" id="editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off">${esc(L.code)}</textarea>`;
    if (L.stdin || (q.tests || []).some(t => t.stdin)) {
      html += `<label class="stdin-label">⌨️ Что вводит пользователь (каждое значение с новой строки):</label>
        <textarea class="stdin" id="stdin" spellcheck="false" rows="2">${esc(L.stdin)}</textarea>`;
    }
    html += `<div class="code-tools">
      <button class="tool" data-act="run">${L.running ? '⏳ Запуск…' : '▶️ Запустить'}</button>
      <button class="tool" data-act="hint">💡 Подсказка</button>
      <button class="tool ghost" data-act="giveup">🏳️ Решение</button></div>`;
    if (L.hint && q.hint) html += `<div class="hint">💡 ${q.hint}</div>`;
    if (L.out) html += `<div class="console">${L.out}</div>`;
    return html;
  }
  // Понятное объяснение ошибки Python для новичка: «что случилось» и «что сделать»
  const ERROR_TIPS = [
    [/expected ':'/, 'Ты забыл двоеточие <code>:</code> в конце строки — после <code>if</code>, <code>for</code>, <code>while</code>, <code>def</code>, <code>else</code>.'],
    [/Maybe you meant '==' or ':=' instead of '='|cannot assign to .* here/, 'В условии сравнивают через <code>==</code>, а один знак <code>=</code> — это присваивание.'],
    [/unterminated (triple-quoted )?string literal|EOL while scanning string/, 'Не закрыта кавычка: у строки должна быть и открывающая, и закрывающая кавычка.'],
    [/'[([{]' was never closed/, 'Не закрыта скобка: посчитай открывающие и закрывающие скобки.'],
    [/unmatched '[)\]}]'|closing parenthesis/, 'Лишняя закрывающая скобка или скобки разного вида.'],
    [/expected an indented block/, 'После двоеточия следующая строка должна начинаться с отступа — 4 пробела.'],
    [/unexpected indent/, 'Лишний отступ в начале строки. Отступ нужен только внутри if, for, def и т. п.'],
    [/unindent does not match|inconsistent use of tabs/, 'Отступы разной ширины. Делай везде ровно по 4 пробела.'],
    [/invalid syntax\. Perhaps you forgot a comma/, 'Похоже, пропущена запятая между значениями.'],
    [/NameError: name '([^']+)' is not defined/, m => `Python не знает имя <code>${esc(m[1])}</code>. Проверь опечатку и большие буквы. Если это текст — возьми его в кавычки, а если переменная — сначала создай её.`],
    [/can only concatenate str \(not "(int|float)"\) to str/, 'Нельзя складывать текст и число. Преврати число в строку: <code>str(x)</code> — или используй f-строку.'],
    [/unsupported operand type\(s\) for [+\-*/]+: '(int|float)' and 'str'|'str' and '(int|float)'/, 'Число и строка не складываются. Если строка из <code>input()</code> — преврати её в число: <code>int(x)</code>.'],
    [/'NoneType' object/, 'Где-то получилось <code>None</code> — часто это функция без <code>return</code>.'],
    [/invalid literal for int\(\)/, 'Эту строку нельзя превратить в число: в ней не только цифры.'],
    [/ZeroDivisionError/, 'Деление на ноль. Проверь делитель перед делением.'],
    [/IndexError: .*index out of range/, 'Такого индекса нет. Индексы начинаются с 0, а последний — <code>len(a) - 1</code>.'],
    [/KeyError: (.+)/, m => `В словаре нет ключа ${esc(m[1])}. Проверь его написание или используй <code>.get()</code>.`],
    [/AttributeError: '(\w+)' object has no attribute '(\w+)'/, m => `У типа <code>${m[1]}</code> нет метода <code>${m[2]}</code>. Проверь опечатку.`],
    [/TypeError: (\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/, m => `Функция <code>${m[1]}</code> ждёт аргументов: ${m[2]}, а передали: ${m[3]}.`],
    [/missing \d+ required positional argument/, 'Функции передали не все аргументы.'],
    [/'(int|float)' object is not (subscriptable|iterable)/, 'С числом так нельзя: брать элемент [i] или перебирать в for можно у строк и списков.'],
    [/RecursionError/, 'Рекурсия не останавливается — проверь базовый случай.'],
    [/EOFError/, 'Программа ждёт ещё ввод (<code>input()</code>), а данных больше нет.'],
  ];
  function explainError(err) {
    if (!err) return '';
    for (const [re, tip] of ERROR_TIPS) {
      const m = err.match(re);
      if (m) return typeof tip === 'function' ? tip(m) : tip;
    }
    return '';
  }
  // Подсказка по проваленному тесту: частые ошибки, когда код работает, но ответ не тот
  function explainTest(t) {
    if (t.err) return explainError(t.err);
    if (t.expr && t.got === 'None' && t.expected !== 'None') {
      return t.printed ? 'Ты напечатал ответ через <code>print</code>, а нужно вернуть его: <code>return</code>.' : 'Функция ничего не вернула (<code>None</code>) — допиши <code>return</code>.';
    }
    if (t.expr && t.got && t.expected && t.got.replace(/'/g, '') === t.expected.replace(/'/g, '') && t.got !== t.expected) return 'Почти! Проверь тип: нужна строка или число?';
    if (!t.expr && t.printed && t.expected && t.printed.trim().toLowerCase() === String(t.expected).trim().toLowerCase()) return 'Почти! Проверь большие и маленькие буквы.';
    return '';
  }
  const tipHtml = tip => (tip ? `<div class="t-tip">🧭 ${tip}</div>` : '');

  const pyFail = r => (r.error === 'timeout'
    ? '⏱ Программа работает слишком долго. Может быть, бесконечный цикл?'
    : (!window.RUN.isWarm(LANG) ? '📶 Не получилось загрузить язык. Проверь интернет и попробуй ещё раз.' : '⚠️ ' + esc(r.error)));

  async function runCode() {
    const L = S.L;
    syncEditor();
    if (LANG === 'html') { L.out = `<div class="console-title">Твоя страница:</div>${htmlPreview(L.code)}`; return render(); }
    L.running = true; L.out = loadingMsg(); render();
    const r = await window.RUN.run(LANG, L.code, [{ run: true, stdin: L.stdin }]);
    L.running = false;
    if (r.error) L.out = pyFail(r);
    else {
      const t = r.results[0];
      L.out = `<div class="console-title">Вывод программы:</div><pre>${esc(t.printed || '(ничего не напечатано)')}</pre>` +
        (t.err ? `<div class="console-err">❌ ${esc(t.err)}</div>${tipHtml(explainError(t.err))}` : '');
    }
    render();
  }
  async function checkCode() {
    const L = S.L, q = L.lesson.questions[L.i];
    syncEditor();
    if (!L.code.trim()) return toast('Сначала напиши код ✍️');
    L.running = true; L.out = loadingMsg() || '⏳ Проверяю…'; render();
    const r = await window.RUN.run(LANG, L.code, q.tests);
    L.running = false;
    if (r.error) { L.out = pyFail(r); return render(); }
    const passed = r.results.every(t => t.ok);
    if (passed) return submitCode(true);
    L.tries++;
    haptic('bad');
    const good = r.results.filter(t => t.ok).length;
    L.out = `<div class="console-title">Тесты: ${good} из ${r.results.length} ✅ — исправь и проверь ещё раз (жизни не тратятся)</div>` +
      r.results.map((t, k) => {
        const what = t.expr ? `<code>${esc(t.expr)}</code>` : (t.stdin ? `ввод <code>${esc(t.stdin.replace(/\n/g, ' ⏎ '))}</code>` : `тест ${k + 1}`);
        if (t.ok) return `<div class="t-ok">✅ ${what}</div>`;
        const got = t.err ? `ошибка: ${esc(t.err)}` : `получилось <code>${esc(t.expr ? (t.got || '') : (t.printed || '(пусто)'))}</code>`;
        return `<div class="t-bad">❌ ${what}: ждали <code>${esc(t.expected)}</code>, ${got}</div>`;
      }).join('') + tipHtml(explainTest(r.results.find(t => !t.ok) || {})) +
      (L.tries >= 2 && !L.hint && q.hint ? '<div class="t-tip">Застрял? Нажми «💡 Подсказка».</div>' : '');
    render();
  }
  async function submitCode(passed) {
    const L = S.L;
    L.busy = true;
    const r = await api.answer(L.id, L.i, { passed });
    L.busy = false;
    if (r.error) { toast('Связь потерялась, попробуй ещё раз'); return render(); }
    S.player = r.player;
    L.checked = r;
    if (r.correct) L.correct++;
    if (L.draftKey) store.set(L.draftKey, null); // задача закрыта — черновик больше не нужен
    haptic(r.correct ? 'ok' : 'bad');
    render();
  }
  function syncEditor() {
    const ed = document.getElementById('editor');
    if (ed && S.L) S.L.code = ed.value;
    const si = document.getElementById('stdin');
    if (si && S.L) S.L.stdin = si.value;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const KIND = { choice: '❓ Выбери ответ', output: '🖥 Что выведет код?', bug: '🐞 Найди ошибку', input: '✍️ Напиши ответ', code: '💻 Напиши программу' };
  function lessonScreen() {
    const L = S.L, q = L.lesson.questions[L.i], n = L.lesson.questions.length, ch = L.checked;
    const pct = ((L.i + (ch ? 1 : 0)) / n) * 100;
    let html = `<div class="lesson"><div class="lesson-top"><button class="close" data-act="quit" aria-label="Выйти">✕</button>
      <div class="progress"><i style="width:${pct}%"></i></div><div class="stat heart">❤️ ${S.player.plus ? '∞' : S.player.hearts}</div></div>
      <div class="q-area">`;
    if (L.i === 0) html += `<div class="intro"><div style="flex:none">${window.pitosha({ size: 84 })}</div><div class="bubble">${L.lesson.intro}</div></div>`;
    html += `<div class="q-kind">${KIND[q.type]}</div><div class="q-text">${esc(q.q)}</div>`;
    if (q.code) html += `<pre class="code">${highlight(q.code)}</pre>`;
    if (q.type === 'code') {
      if (!ch) html += codeBlock(q, L);
      else html += `<pre class="code">${highlight(L.code || '')}</pre>`;
    } else if (q.type === 'input') {
      const cls = ch ? (ch.correct ? 'opt right' : 'opt wrong') : '';
      // В форме: кнопка «Готово/Перейти» на телефонной клавиатуре отправляет форму, даже если не шлёт клавишу Enter
      html += `<form id="answer-form" autocomplete="off"><input class="answer-input ${cls}" id="answer" enterkeyhint="go" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Твой ответ… (Enter — проверить)" value="${esc(L.text)}" ${ch ? 'disabled' : ''}></form>`;
      if (!ch) html += `<button class="idk" data-act="idk">Не знаю 🤷</button>`;
    } else {
      const mono = q.options.some(o => /[()"=]/.test(o)) || q.type === 'output';
      html += '<div class="options">' + L.order.map((orig, k) => {
        let cls = 'opt' + (mono ? '' : ' plain');
        if (ch) { if (orig === 0) cls += ' right'; else if (k === L.sel) cls += ' wrong'; }
        else if (k === L.sel) cls += ' sel';
        return `<button class="${cls}" data-opt="${k}" ${ch ? 'disabled' : ''}>${esc(q.options[orig])}</button>`;
      }).join('') + '</div>';
    }
    html += '</div>';
    // Нижняя панель: «Проверить» или результат
    if (!ch) {
      if (q.type === 'code') {
        html += `<div class="bottom"><div class="bottom-inner"><button class="big green" data-act="check-code" title="Ctrl+Enter" ${L.running ? 'disabled' : ''}>${L.running ? '⏳ Проверяю…' : 'Проверить'}</button></div></div>`;
      } else {
        const ready = q.type === 'input' ? L.text.trim().length > 0 : L.sel !== null;
        html += `<div class="bottom"><div class="bottom-inner"><button class="big green" data-act="check" ${ready ? '' : 'disabled'}>Проверить</button></div></div>`;
      }
    } else {
      const ok = ch.correct;
      const rightHtml = q.type === 'code' ? `Вот решение:<pre class="code sol">${highlight(ch.right || '')}</pre>` : `Правильно: <code>${esc(ch.right)}</code><br>`;
      html += `<div class="bottom ${ok ? 'ok' : 'bad'}"><div class="bottom-inner">
        <div class="fb-title">${ok ? '✅ ' + (q.type === 'code' ? 'Все тесты пройдены!' : ['Отлично!', 'Верно!', 'Имба!', 'Красава!', 'В точку!'][Math.floor(Math.random() * 5)]) : (q.type === 'code' ? '🏳️ Ничего, разберём' : '❌ Не совсем')}</div>
        <div class="fb-text">${ok ? '' : rightHtml}💡 ${esc(ch.explain || '')}</div>
        <button class="big ${ok ? 'green' : 'red'}" data-act="next">Дальше</button></div></div>`;
    }
    return html + '</div>';
  }

  async function check(idk) {
    const L = S.L, q = L.lesson.questions[L.i];
    if (L.checked || L.busy) return;
    let answer;
    if (idk) answer = null;
    else if (q.type === 'input') answer = L.text;
    else answer = L.order[L.sel];
    L.busy = true;
    const r = await api.answer(L.id, L.i, answer);
    L.busy = false;
    if (r.error) { toast('Связь потерялась, попробуй ещё раз'); return; }
    S.player = r.player;
    L.checked = r;
    if (r.correct) L.correct++;
    haptic(r.correct ? 'ok' : 'bad');
    render();
    if (!r.correct) { const a = document.querySelector('.q-area'); if (a) { a.classList.add('shake'); } }
  }
  function next() {
    const L = S.L, r = L.checked;
    if (r.failed) { S.view = 'nohearts'; S.L = null; return render(); }
    if (r.finished) {
      S.finish = { ...r.finished, title: L.lesson.title, correct: L.correct, total: L.lesson.questions.length, nextId: (LESSONS[lessonIndex(L.id) + 1] || {}).id };
      S.view = 'finish'; S.L = null; S.top = null; haptic('ok');
      render(); celebrate();
      return;
    }
    L.i++;
    newQuestion();
    render();
  }
  function askQuit() {
    const quit = () => { S.view = 'tabs'; S.L = null; render(); };
    const text = 'Выйти из урока? Потом продолжишь с этого же вопроса.';
    if (tg && tg.showConfirm) tg.showConfirm(text, ok => { if (ok) quit(); });
    else if (confirm(text)) quit();
  }

  function finishScreen() {
    const f = S.finish;
    const acc = Math.round((f.correct / f.total) * 100);
    return `<div class="center"><div class="bounce">${window.pitosha({ size: 170 })}</div>
      <h1>${f.perfect ? 'Идеально! 🎉' : 'Урок пройден! 🎉'}</h1><p>«${esc(f.title)}»</p>
      <div class="rewards">
        <div class="reward y"><small>Опыт${f.boost ? ` ⚡x${f.boost}` : ''}</small><b>+${f.xp}</b></div>
        <div class="reward b"><small>Алмазы</small><b>💎 +${f.gems || 0}</b></div>
        <div class="reward o"><small>Серия</small><b>🔥 ${f.streak}</b></div>
        <div class="reward g"><small>Точность</small><b>${acc}%</b></div>
      </div>
      ${f.levelUp ? `<p style="color:var(--yellow);font-size:18px">🆙 Новый уровень: ${f.level}!</p>` : ''}
      ${f.streakGems ? `<div class="card streak-win">${I('fire')} <b>Серия ${f.streakGems.n} ${days(f.streakGems.n)}!</b> Награда: +${f.streakGems.gems} 💎</div>` : ''}
      ${f.streakUp && f.streak > 1 ? `<p>Серия ${f.streak} ${days(f.streak)} подряд — так держать!</p>` : ''}
      ${(f.ach || []).map(a => `<div class="ach-new"><span>${a.ico}</span><b>Новая ачивка: ${esc(a.title)}</b></div>`).join('')}
      <button class="share-btn" data-act="share">📤 Поделиться результатом</button>
      <div class="bottom"><div class="bottom-inner">
        ${f.nextId ? `<button class="big" data-lesson="${f.nextId}">Следующий урок</button><button class="big ghost" data-act="home">На главную</button>`
                   : '<button class="big" data-act="home">На главную</button>'}
      </div></div></div>`;
  }

  function noHeartsScreen() {
    const p = S.player;
    return `<div class="center">${window.pitosha({ mood: 'sad', size: 150 })}<h1>Жизни закончились</h1>
      <p>Новая жизнь через ${mins(p.nextHeartMs || 60000)}.<br>Отдохни — Питоша подождёт 🐍</p>
      <div class="bottom"><div class="bottom-inner"><button class="big red" data-buy="hearts">❤️ Восстановить за 10 ⭐</button>
      <button class="big ghost" data-act="home">Вернуться</button></div></div></div>`;
  }

  // Редактор: Tab = 4 пробела, Enter сохраняет отступ (и добавляет 4 после двоеточия), высота по коду
  function setupEditor(ed, onChange) {
    const fit = () => { ed.style.height = 'auto'; ed.style.height = Math.max(150, ed.scrollHeight + 4) + 'px'; };
    fit();
    ed.addEventListener('input', () => { onChange(ed.value); fit(); });
    ed.addEventListener('keydown', e => {
      const v = ed.value, s = ed.selectionStart, en = ed.selectionEnd;
      if (e.key === 'Tab') {
        e.preventDefault();
        ed.value = v.slice(0, s) + '    ' + v.slice(en);
        ed.selectionStart = ed.selectionEnd = s + 4;
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const lineStart = v.lastIndexOf('\n', s - 1) + 1;
        const line = v.slice(lineStart, s);
        let indent = (line.match(/^ */) || [''])[0];
        if (/:\s*$/.test(line)) indent += '    ';
        ed.value = v.slice(0, s) + '\n' + indent + v.slice(en);
        ed.selectionStart = ed.selectionEnd = s + 1 + indent.length;
      } else return;
      onChange(ed.value); fit();
    });
  }
  const saveDraft = () => { if (S.L && S.L.draftKey) store.set(S.L.draftKey, S.L.code); };

  // ---------- Отрисовка ----------
  function render() {
    if (!S.player) return;
    let html;
    if (S.view === 'lesson') html = lessonScreen();
    else if (S.view === 'finish') html = finishScreen();
    else if (S.view === 'nohearts') html = noHeartsScreen();
    else if (S.view === 'register') html = registerScreen();
    else if (S.view === 'onboard') html = onboardScreen();
    else if (S.view === 'placement') html = placementScreen();
    else if (S.view === 'sandbox') html = sandboxScreen();
    else if (S.view === 'langpick') html = langPickScreen();
    else if (S.view === 'admin') html = adminScreen();
    else if (S.view === 'snippet') html = snippetScreen();
    else html = topbar() + ({ learn: learnScreen, quests: questsScreen, top: topScreen, friends: friendsScreen, shop: shopScreen, me: meScreen, more: moreScreen }[S.tab] || learnScreen)() + tabs();
    $app.innerHTML = svgify(html);
    document.body.classList.toggle('with-nav', S.view === 'tabs'); // боковая панель на компьютере — только на вкладках
    const noBack = S.view === 'tabs' || S.view === 'onboard' || (S.view === 'register' && S.reg.first) || (S.view === 'placement' && S.P && S.P.result);
    if (tg && tg.BackButton) { if (noBack) tg.BackButton.hide(); else tg.BackButton.show(); }
    const editor = document.getElementById('editor');
    if (editor) setupEditor(editor, v => { S.L.code = v; saveDraft(); });
    const sbEditor = document.getElementById('sb-editor');
    if (sbEditor) setupEditor(sbEditor, v => { S.sandbox.code = v; store.set(sbKey(S.sandbox.lang), v); });
    const regInput = document.getElementById('reg-name');
    if (regInput) regInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveProfile(); });
    const friendForm = document.getElementById('friend-form');
    if (friendForm) friendForm.addEventListener('submit', e => { e.preventDefault(); searchFriends(); });
    const photoInput = document.getElementById('photo-input');
    if (photoInput) photoInput.addEventListener('change', () => onPhotoPicked(photoInput));
    const input = document.getElementById('answer');
    if (input && !S.L.checked) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.addEventListener('input', () => {
        S.L.text = input.value;
        const b = document.querySelector('[data-act="check"]');
        if (b) b.disabled = !input.value.trim();
      });
      const form = document.getElementById('answer-form');
      form.addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) check(false); });
    }
  }

  // Клавиатура в уроке: Enter — «Проверить», а после проверки — «Дальше». В редакторе кода — Ctrl+Enter.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.repeat || S.view !== 'lesson' || !S.L) return;
    const L = S.L, q = L.lesson.questions[L.i];
    const inEditor = e.target && (e.target.id === 'editor' || e.target.id === 'stdin');
    if (inEditor) {
      if ((e.ctrlKey || e.metaKey) && !L.checked && !L.running && !L.busy) { e.preventDefault(); checkCode(); }
      return; // обычный Enter в редакторе — перенос строки
    }
    if (L.checked) { if (!L.busy) { e.preventDefault(); next(); } return; }
    if (e.target && e.target.id === 'answer') return; // поле ответа отправляется через форму
    if (q.type === 'code') { if ((e.ctrlKey || e.metaKey) && !L.running && !L.busy) { e.preventDefault(); checkCode(); } return; }
    if (q.type !== 'input' && L.sel !== null) { e.preventDefault(); check(false); }
  });

  $app.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.tab) { S.tab = d.tab; S.view = 'tabs'; haptic(); if (d.shopSide) S.shopSide = d.shopSide; if (d.topMode) S.topMode = d.topMode; if (d.tab === 'top') S.top = null; if (d.tab === 'friends') S.fr = null; render(); window.scrollTo(0, 0); }
    else if (d.topMode) { S.topMode = d.topMode; S.top = null; haptic(); render(); }
    else if (d.shopSide) { S.shopSide = d.shopSide; haptic(); render(); }
    else if (d.gemBuy) gemBuy(d.gemBuy);
    else if (d.quest) claimQuestChest(d.quest);
    else if (d.follow) frAction(() => api.follow(Number(d.follow)), r => (r.friend ? '🤝 Теперь вы друзья!' : '👋 Подписка отправлена — ждём, когда друг подпишется в ответ'));
    else if (d.unfollow) confirmThen('Удалить из друзей?', () => frAction(() => api.unfollow(Number(d.unfollow))));
    else if (d.sinvite) frAction(() => api.streakInvite(Number(d.sinvite)), '🏁 Приглашение в забег отправлено!');
    else if (d.saccept) frAction(() => api.streakAccept(Number(d.saccept)), '🏁 Забег начался! Пройдите сегодня хотя бы по 1 уроку');
    else if (d.sdecline) frAction(() => api.streakDecline(Number(d.sdecline)));
    else if (d.send) confirmThen('Закончить забег?', () => frAction(() => api.streakEnd(Number(d.send))));
    else if (d.sclaim) frAction(() => api.streakClaim(Number(d.sclaim))).then(r => { if (r.chest) showChest(r.chest, `Забег: ${r.chest.n} ${days(r.chest.n)}`); });
    else if (d.snip) openSnippet(d.snip);
    else if (d.snipShare) shareLink(d.snipShare, 'Посмотри мою программу на Python 🐍');
    else if (d.act === 'friend-search') searchFriends();
    else if (d.act === 'invite') shareLink(S.player.refLink, 'Учи программирование вместе со мной в Питоше 🐍 Python, JavaScript, Lua для Roblox и другие! По моей ссылке мы сразу станем друзьями.');
    else if (d.act === 'sb-save') saveSnippet();
    else if (d.act === 'snip-to-sandbox') { const lang = S.snip.lang || 'python'; store.set(sbKey(lang), S.snip.code); S.sandbox = { lang, code: S.snip.code, stdin: '', out: '', running: false }; S.view = 'sandbox'; render(); }
    else if (d.lang) chooseLang(d.lang);
    else if (d.act === 'langpick') { S.view = 'langpick'; haptic(); render(); window.scrollTo(0, 0); }
    else if (d.sblang) switchSandbox(d.sblang);
    else if (d.act === 'snip-run') runSnippet();
    else if (d.act === 'vibro') { store.set('pitosha-vibro', store.get('pitosha-vibro') === 'off' ? 'on' : 'off'); haptic(); render(); }
    else if (d.place !== undefined) placementAnswer(d.place);
    else if (d.theme) pickTheme(d.theme);
    else if (d.act === 'daily') claimDaily();
    else if (d.act === 'onb-new') { S.view = 'tabs'; S.tab = 'learn'; render(); }
    else if (d.act === 'onb-test') startPlacement();
    else if (d.act === 'share') shareResult();
    else if (d.act === 'sandbox') openSandbox();
    else if (d.act === 'admin') openAdmin();
    else if (d.act === 'sb-run') runSandbox();
    else if (d.act === 'renew') { S.tab = 'shop'; S.view = 'tabs'; render(); window.scrollTo(0, 0); }
    else if (d.lesson) { if (t.getAttribute('aria-disabled') === 'true') toast('🔒 Сначала пройди предыдущий урок'); else openLesson(d.lesson); }
    else if (d.opt !== undefined) { S.L.sel = Number(d.opt); haptic(); render(); }
    else if (d.buy) buy(d.buy);
    else if (d.act === 'check') check(false);
    else if (d.act === 'check-code') { if (!S.L.running) checkCode(); }
    else if (d.act === 'run') { if (!S.L.running) runCode(); }
    else if (d.act === 'hint') { syncEditor(); S.L.hint = true; render(); }
    else if (d.act === 'giveup') {
      syncEditor();
      const sure = () => submitCode(false);
      if (tg && tg.showConfirm) tg.showConfirm('Показать решение? Задача засчитается как ошибка (−1 жизнь).', ok => { if (ok) sure(); });
      else if (confirm('Показать решение? Задача засчитается как ошибка (−1 жизнь).')) sure();
    }
    else if (d.act === 'idk') check(true);
    else if (d.act === 'next') next();
    else if (d.act === 'quit') askQuit();
    else if (d.act === 'home') { S.view = 'tabs'; S.tab = 'learn'; S.P = null; render(); window.scrollTo(0, 0); }
    else if (d.avatar) { const inp = document.getElementById('reg-name'); if (inp) S.reg.name = inp.value; S.reg.avatar = d.avatar; haptic(); render(); }
    else if (d.act === 'save-profile') saveProfile();
    else if (d.act === 'edit-profile') { openRegister(false); render(); window.scrollTo(0, 0); }
    else if (d.act === 'reset') { if (confirm('Сбросить весь прогресс?')) { api.reset(); load(); } }
  });

  // Жизни восстанавливаются со временем — обновляем раз в минуту
  setInterval(() => { if (S.view === 'tabs' || S.view === 'nohearts') api.state().then(r => { if (r.player) { S.player = r.player; if (S.view !== 'lesson') render(); } }); }, 60000);

  if (api.demo) window.PITOSHA_DEBUG = S; // для проверки в демо-режиме
  load();
})();
