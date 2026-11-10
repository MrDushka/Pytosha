// Мини-приложение Питоши: дорожка уроков, урок, финиш, профиль, рейтинг, магазин.
(function () {
  const { UNITS, LESSONS, lessonById, lessonIndex } = window.COURSE;
  const C = window.CORE;
  const api = window.API;
  const tg = window.Telegram && window.Telegram.WebApp;
  const $app = document.getElementById('app');

  const S = { tab: 'learn', view: 'tabs', player: null, L: null, finish: null, top: null };

  // ---------- Telegram ----------
  if (tg) {
    tg.ready(); tg.expand();
    try { tg.setHeaderColor('#0d1f3c'); tg.setBackgroundColor('#0d1f3c'); } catch (e) { /* старый клиент */ }
    if (tg.BackButton) tg.BackButton.onClick(() => { if (S.view === 'lesson') askQuit(); else { S.view = 'tabs'; render(); } });
  }
  const haptic = kind => { try { if (kind === 'ok' || kind === 'bad') tg.HapticFeedback.notificationOccurred(kind === 'ok' ? 'success' : 'error'); else tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* не в Telegram */ } };

  // ---------- Помощники ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const mins = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`; };
  const days = n => (n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней');

  // Подсветка Python-кода
  const KW = new Set('if elif else for while def return import from in and or not True False None class pass break continue'.split(' '));
  const FN = new Set('print len input int str float range upper lower list dict sum max min abs round type'.split(' '));
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
    render();
  }

  function topbar() {
    const p = S.player;
    const hearts = p.plus ? '∞' : p.hearts;
    return `<div class="topbar">
      <div class="stat fire ${p.streakNow ? '' : 'off'}">🔥 ${p.streakNow}</div>
      <div class="stat xp">⭐ ${p.xp}</div>
      <div class="stat heart">❤️ ${hearts}${p.plus ? ' <span class="plus-badge">PLUS</span>' : ''}</div>
    </div>`;
  }
  function tabs() {
    const t = [['learn', '🏠', 'Учёба'], ['top', '🏆', 'Рейтинг'], ['shop', '🛒', 'Магазин'], ['me', '👤', 'Профиль']];
    return `<nav class="tabs"><div class="tabs-inner">${t.map(([id, ico, name]) =>
      `<button class="tab ${S.tab === id ? 'active' : ''}" data-tab="${id}"><span>${ico}</span>${name}</button>`).join('')}</div></nav>`;
  }

  // ---------- Дорожка уроков ----------
  const OFFSETS = [0, 70, 100, 70, 0, -70, -100, -70];
  function learnScreen() {
    const p = S.player;
    const current = LESSONS.findIndex((l, i) => !p.done[l.id] && C.isUnlocked(p, LESSONS, i));
    let html = '<div class="screen">';
    for (const unit of UNITS) {
      html += `<div class="unit"><small>Раздел ${UNITS.indexOf(unit) + 1}</small><b>${esc(unit.title.replace(/^Раздел \d+\.\s*/, ''))}</b></div><div class="path">`;
      unit.lessons.forEach(l => {
        const i = lessonIndex(l.id);
        const done = !!p.done[l.id];
        const open = C.isUnlocked(p, LESSONS, i);
        const isCur = i === current;
        const cls = done ? 'done' : !open ? 'locked' : 'open';
        const off = OFFSETS[i % OFFSETS.length];
        html += `<div class="node-wrap ${isCur ? 'current' : ''}" style="transform:translateX(${off}px)">
          ${isCur ? '<div class="start-bubble">СТАРТ</div>' : ''}
          <button class="node ${cls} ${isCur ? 'current' : ''}" data-lesson="${l.id}" ${open ? '' : 'aria-disabled="true"'}>${done ? '✓' : open ? l.emoji : '🔒'}</button>
          <div class="node-title">${i + 1}. ${esc(l.title)}</div>
          ${isCur ? `<div class="path-mascot" style="${off >= 0 ? 'right' : 'left'}:${off >= 0 ? 120 : 120}px;top:-6px">${window.pitosha({ size: 96 })}</div>` : ''}
        </div>`;
      });
      html += '</div>';
    }
    html += '<div class="soon">🚧 Раздел 2 «Условия и циклы» — скоро!</div></div>';
    return html;
  }

  // ---------- Профиль ----------
  function meScreen() {
    const p = S.player;
    const lv = C.level(p.xp), inLv = C.levelProgress(p.xp);
    const doneCount = LESSONS.filter(l => p.done[l.id]).length;
    return `<div class="screen"><h2 class="title">Профиль</h2>
      <div class="card"><div class="profile-head">${window.pitosha({ size: 72 })}<div style="flex:1"><b>${esc(p.name || 'Ученик')}</b>
        <div style="color:var(--muted);font-weight:800">Уровень ${lv} · ${inLv}/${C.XP_PER_LEVEL} XP</div>
        <div class="lvl-bar"><i style="width:${(inLv / C.XP_PER_LEVEL) * 100}%"></i></div></div></div></div>
      <div class="grid2">
        <div class="tile"><b>🔥 ${p.streakNow}</b><small>серия, ${days(p.streakNow)}</small></div>
        <div class="tile"><b>🏅 ${p.bestStreak || 0}</b><small>рекорд серии</small></div>
        <div class="tile"><b>⭐ ${p.xp}</b><small>всего опыта</small></div>
        <div class="tile"><b>📚 ${doneCount}/${LESSONS.length}</b><small>уроков пройдено</small></div>
      </div>
      <div class="card" style="margin-top:12px">${p.plus ? '👑 <b>Питоша Плюс</b> активен до ' + new Date(p.plusUntil).toLocaleDateString('ru-RU') : '❤️ ' + (p.hearts < C.MAX_HEARTS ? `Жизней: ${p.hearts}/${C.MAX_HEARTS}, новая через ${mins(p.nextHeartMs)}` : 'Все жизни на месте')}
        ${p.freezes ? `<br>🧊 Заморозок серии: ${p.freezes}` : ''}</div>
      ${api.demo ? '<p class="note">Демо-режим: прогресс хранится в этом браузере.</p><button class="big ghost" data-act="reset">Сбросить прогресс</button>' : ''}
    </div>`;
  }

  // ---------- Рейтинг ----------
  function topScreen() {
    if (!S.top) { api.top().then(r => { S.top = r.top || []; if (S.tab === 'top') render(); }); return '<div class="screen"><h2 class="title">Рейтинг</h2><p class="note">Загружаю…</p></div>'; }
    const medals = ['🥇', '🥈', '🥉'];
    return `<div class="screen"><h2 class="title">Рейтинг</h2><div class="card">${S.top.length ? S.top.map((u, i) =>
      `<div class="row ${u.me ? 'me' : ''}"><div class="place">${medals[i] || u.place || i + 1}</div><div class="who">${esc(u.name)}${u.me ? ' (ты)' : ''}</div><div class="pts">${u.xp} XP</div></div>`).join('')
      : '<p class="note">Пока пусто — пройди урок и стань первым!</p>'}</div>
      <p class="note">Опыт дают за уроки. Без ошибок — бонус!</p></div>`;
  }

  // ---------- Магазин ----------
  const SHOP = [
    { id: 'hearts', ico: '❤️', name: 'Все жизни сразу', desc: 'Не ждать восстановления', price: 10 },
    { id: 'freeze', ico: '🧊', name: 'Заморозка серии', desc: 'Пропустишь день — серия не сгорит', price: 15 },
    { id: 'plus', ico: '👑', name: 'Питоша Плюс', desc: 'Безлимит жизней на 30 дней', price: 75 },
  ];
  function shopScreen() {
    return `<div class="screen"><h2 class="title">Магазин</h2>
      ${SHOP.map(it => `<div class="card shop-item"><div class="ico">${it.ico}</div><div class="info"><b>${it.name}</b><small>${it.desc}</small></div>
        <button class="price" data-buy="${it.id}">${it.price} ⭐</button></div>`).join('')}
      <p class="note">Оплата звёздами Telegram ⭐</p></div>`;
  }
  async function buy(id) {
    haptic();
    const r = await api.buy(id);
    if (r.error === 'demo') return toast('В демо-режиме оплаты нет — заработает в Telegram');
    if (r.error || !r.invoiceUrl) return toast('Не получилось открыть оплату, попробуй позже');
    tg.openInvoice(r.invoiceUrl, async status => {
      if (status === 'paid') { haptic('ok'); toast('Спасибо! Покупка получена 🎉'); setTimeout(load, 1500); }
    });
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
    newQuestion();
    S.view = 'lesson';
    render();
  }
  function newQuestion() {
    const L = S.L;
    const q = L.lesson.questions[L.i];
    L.sel = null; L.text = ''; L.checked = null;
    L.order = q.options ? shuffle(q.options.map((_, k) => k)) : null;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const KIND = { choice: '❓ Выбери ответ', output: '🖥 Что выведет код?', bug: '🐞 Найди ошибку', input: '✍️ Напиши ответ' };
  function lessonScreen() {
    const L = S.L, q = L.lesson.questions[L.i], n = L.lesson.questions.length, ch = L.checked;
    const pct = ((L.i + (ch ? 1 : 0)) / n) * 100;
    let html = `<div class="lesson"><div class="lesson-top"><button class="close" data-act="quit" aria-label="Выйти">✕</button>
      <div class="progress"><i style="width:${pct}%"></i></div><div class="stat heart">❤️ ${S.player.plus ? '∞' : S.player.hearts}</div></div>
      <div class="q-area">`;
    if (L.i === 0) html += `<div class="intro"><div style="flex:none">${window.pitosha({ size: 84 })}</div><div class="bubble">${L.lesson.intro}</div></div>`;
    html += `<div class="q-kind">${KIND[q.type]}</div><div class="q-text">${esc(q.q)}</div>`;
    if (q.code) html += `<pre class="code">${highlight(q.code)}</pre>`;
    if (q.type === 'input') {
      const cls = ch ? (ch.correct ? 'opt right' : 'opt wrong') : '';
      html += `<input class="answer-input ${cls}" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Твой ответ…" value="${esc(L.text)}" ${ch ? 'disabled' : ''}>`;
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
      const ready = q.type === 'input' ? L.text.trim().length > 0 : L.sel !== null;
      html += `<div class="bottom"><div class="bottom-inner"><button class="big green" data-act="check" ${ready ? '' : 'disabled'}>Проверить</button></div></div>`;
    } else {
      const ok = ch.correct;
      html += `<div class="bottom ${ok ? 'ok' : 'bad'}"><div class="bottom-inner">
        <div class="fb-title">${ok ? '✅ ' + ['Отлично!', 'Верно!', 'Имба!', 'Красава!', 'В точку!'][Math.floor(Math.random() * 5)] : '❌ Не совсем'}</div>
        <div class="fb-text">${ok ? '' : `Правильно: <code>${esc(ch.right)}</code><br>`}💡 ${esc(ch.explain || '')}</div>
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
    if (r.finished) { S.finish = { ...r.finished, title: L.lesson.title, correct: L.correct, total: L.lesson.questions.length, nextId: (LESSONS[lessonIndex(L.id) + 1] || {}).id }; S.view = 'finish'; S.L = null; S.top = null; haptic('ok'); return render(); }
    L.i++;
    newQuestion();
    render();
  }
  function askQuit() {
    const quit = () => { S.view = 'tabs'; S.L = null; render(); };
    if (tg && tg.showConfirm) tg.showConfirm('Выйти из урока? Прогресс этого урока не сохранится.', ok => { if (ok) quit(); });
    else if (confirm('Выйти из урока? Прогресс этого урока не сохранится.')) quit();
  }

  function finishScreen() {
    const f = S.finish;
    const acc = Math.round((f.correct / f.total) * 100);
    return `<div class="center"><div class="bounce">${window.pitosha({ size: 170 })}</div>
      <h1>${f.perfect ? 'Идеально! 🎉' : 'Урок пройден! 🎉'}</h1><p>«${esc(f.title)}»</p>
      <div class="rewards">
        <div class="reward y"><small>Опыт</small><b>+${f.xp}</b></div>
        <div class="reward o"><small>Серия</small><b>🔥 ${f.streak}</b></div>
        <div class="reward g"><small>Точность</small><b>${acc}%</b></div>
      </div>
      ${f.levelUp ? `<p style="color:var(--yellow);font-size:18px">🆙 Новый уровень: ${f.level}!</p>` : ''}
      ${f.streakUp && f.streak > 1 ? `<p>Серия ${f.streak} ${days(f.streak)} подряд — так держать!</p>` : ''}
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

  // ---------- Отрисовка ----------
  function render() {
    if (!S.player) return;
    let html;
    if (S.view === 'lesson') html = lessonScreen();
    else if (S.view === 'finish') html = finishScreen();
    else if (S.view === 'nohearts') html = noHeartsScreen();
    else html = topbar() + ({ learn: learnScreen, top: topScreen, shop: shopScreen, me: meScreen }[S.tab])() + tabs();
    $app.innerHTML = html;
    if (tg && tg.BackButton) { if (S.view === 'tabs') tg.BackButton.hide(); else tg.BackButton.show(); }
    const input = document.getElementById('answer');
    if (input && !S.L.checked) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.addEventListener('input', () => {
        S.L.text = input.value;
        const b = document.querySelector('[data-act="check"]');
        if (b) b.disabled = !input.value.trim();
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) check(false); });
    }
  }

  $app.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.tab) { S.tab = d.tab; S.view = 'tabs'; haptic(); if (d.tab === 'top') S.top = null; render(); window.scrollTo(0, 0); }
    else if (d.lesson) { if (t.getAttribute('aria-disabled') === 'true') toast('🔒 Сначала пройди предыдущий урок'); else openLesson(d.lesson); }
    else if (d.opt !== undefined) { S.L.sel = Number(d.opt); haptic(); render(); }
    else if (d.buy) buy(d.buy);
    else if (d.act === 'check') check(false);
    else if (d.act === 'idk') check(true);
    else if (d.act === 'next') next();
    else if (d.act === 'quit') askQuit();
    else if (d.act === 'home') { S.view = 'tabs'; S.tab = 'learn'; render(); window.scrollTo(0, 0); }
    else if (d.act === 'reset') { if (confirm('Сбросить весь прогресс?')) { api.reset(); load(); } }
  });

  // Жизни восстанавливаются со временем — обновляем раз в минуту
  setInterval(() => { if (S.view === 'tabs' || S.view === 'nohearts') api.state().then(r => { if (r.player) { S.player = r.player; if (S.view !== 'lesson') render(); } }); }, 60000);

  if (api.demo) window.PITOSHA_DEBUG = S; // для проверки в демо-режиме
  load();
})();
