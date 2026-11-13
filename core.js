// Правила игры Питоши — общие для мини-приложения и сервера (чтобы считали одинаково).
// Всё — чистые функции над объектом ученика: { xp, hearts, heartsAt, streak, bestStreak, lastDay, done }.
(function (root) {
  const MAX_HEARTS = 5;
  const HEART_MIN = 30;            // новая жизнь каждые 30 минут (5 жизней ≈ 2,5 часа)
  const XP_PER_LEVEL = 50;

  const pad = n => String(n).padStart(2, '0');
  // День по Москве (UTC+3, без перехода на летнее время) — серия считается одинаково у всех
  function mskDay(date) {
    const d = new Date(date.getTime() + 3 * 3600000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const prevDay = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

  function newPlayer() {
    return { xp: 0, hearts: MAX_HEARTS, heartsAt: null, streak: 0, bestStreak: 0, lastDay: null, done: {}, plusUntil: null, freezes: 0 };
  }

  const hasPlus = (p, now) => !!(p.plusUntil && new Date(p.plusUntil) > now);

  // ---------- Новичок: первые 7 дней жизни не тратятся ----------
  const NEWBIE_DAYS = 7;
  const dayNum = iso => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
  // Запоминаем первый день ученика (у старых учеников — день, когда впервые зашли после обновления)
  function ensureStart(p, now) { if (!p.startDay) p.startDay = mskDay(now); return p; }
  const newbieDaysLeft = (p, now) => (p.startDay ? Math.max(0, NEWBIE_DAYS - (dayNum(mskDay(now)) - dayNum(p.startDay))) : 0);
  const isNewbie = (p, now) => newbieDaysLeft(p, now) > 0;
  const unlimitedHearts = (p, now) => hasPlus(p, now) || isNewbie(p, now);

  // ---------- Жизни ----------
  function refreshHearts(p, now) {
    if (unlimitedHearts(p, now)) { p.hearts = MAX_HEARTS; p.heartsAt = null; return p; }
    if (p.hearts >= MAX_HEARTS || !p.heartsAt) { if (p.hearts >= MAX_HEARTS) p.heartsAt = null; return p; }
    const step = HEART_MIN * 60000;
    const gained = Math.floor((now - new Date(p.heartsAt)) / step);
    if (gained > 0) {
      p.hearts = Math.min(MAX_HEARTS, p.hearts + gained);
      p.heartsAt = p.hearts >= MAX_HEARTS ? null : new Date(new Date(p.heartsAt).getTime() + gained * step).toISOString();
    }
    return p;
  }
  function loseHeart(p, now) {
    if (unlimitedHearts(p, now)) return p;
    if (p.hearts >= MAX_HEARTS) p.heartsAt = now.toISOString();
    p.hearts = Math.max(0, p.hearts - 1);
    return p;
  }
  function nextHeartMs(p, now) {
    if (p.hearts >= MAX_HEARTS || !p.heartsAt) return 0;
    return Math.max(0, new Date(p.heartsAt).getTime() + HEART_MIN * 60000 - now);
  }

  // ---------- Серия ----------
  function currentStreak(p, now) {
    const today = mskDay(now);
    return p.lastDay === today || p.lastDay === prevDay(today) ? p.streak : 0;
  }
  // Если пропущен ровно один день и есть «заморозка» — серия не сгорает
  function applyFreeze(p, now) {
    const today = mskDay(now);
    if (p.freezes > 0 && p.lastDay && p.lastDay === prevDay(prevDay(today))) {
      p.freezes--; p.lastDay = prevDay(today); return true;
    }
    return false;
  }
  function bumpStreak(p, now) {
    const today = mskDay(now);
    if (p.lastDay === today) return false;
    p.activeDays = (p.activeDays || 0) + 1; // дни, когда занимался, — нужны для приглашений
    applyFreeze(p, now);
    p.streak = p.lastDay === prevDay(today) ? p.streak + 1 : 1;
    p.bestStreak = Math.max(p.bestStreak || 0, p.streak);
    p.lastDay = today;
    return true;
  }

  // ---------- Опыт ----------
  const level = xp => Math.floor(xp / XP_PER_LEVEL) + 1;
  const levelProgress = xp => xp % XP_PER_LEVEL;
  function lessonXp({ firstTime, correct, mistakes }) {
    const perfect = mistakes === 0;
    return firstTime ? correct * 2 + 5 + (perfect ? 5 : 0) : correct + (perfect ? 3 : 0);
  }

  // ---------- Уроки ----------
  // Админу (создателю) открыты все уроки сразу
  const isUnlocked = (p, lessons, i) => i === 0 || !!p.admin || !!p.done[lessons[i - 1].id];

  // Текстовый ответ: без регистра, лишних пробелов и кавычек вокруг; полный код тоже засчитывается
  const norm = s => String(s).trim().toLowerCase().replace(/ё/g, 'е')
    .replace(/^[`'"«“]+|[`'"»”]+$/g, '').replace(/\s+/g, ' ').replace(/\s*([()=+*/,])\s*/g, '$1');
  // Правильный ответ, который показываем после ошибки
  const rightAnswer = q => (q.type === 'input' ? q.answers[0] : q.type === 'code' ? q.solution : q.options[0]);
  function checkAnswer(q, answer) {
    // Практика: код запускается и проверяется тестами у ученика (Python в браузере), сюда приходит итог
    if (q.type === 'code') return !!(answer && answer.passed === true);
    if (q.type === 'input') {
      const a = norm(answer);
      return q.answers.some(r => a === norm(r) || (q.code && a === norm(q.code.replace('___', r))));
    }
    return Number(answer) === 0; // для кнопок: индекс исходного варианта; правильный — options[0]
  }

  // Завершить урок: ответы → опыт, алмазы, серия, отметка «пройден», задания, ачивки
  function finishLesson(p, lesson, { correct, mistakes }, now, rnd = Math.random) {
    const firstTime = !p.done[lesson.id] || !!p.done[lesson.id].skipped;
    const mult = boostNow(p, now);
    const xp = Math.round(lessonXp({ firstTime, correct, mistakes }) * mult); // бустер из сундука умножает опыт
    const lvlBefore = level(p.xp);
    p.xp += xp;
    const gems = 1 + Math.floor(rnd() * 10); // 1…10 алмазов за урок
    p.gems = (p.gems || 0) + gems;
    questEvent(p, now, 'lessons', 1);
    questEvent(p, now, 'xp', xp);
    if (mistakes === 0) questEvent(p, now, 'perfect', 1);
    const prev = p.done[lesson.id];
    p.done[lesson.id] = { best: prev && !prev.skipped ? Math.min(prev.best, mistakes) : mistakes, times: (prev ? prev.times : 0) + 1 };
    // «Неделя без ошибок»: дни подряд, когда все уроки пройдены без ошибок
    const today = mskDay(now);
    if (mistakes > 0) { p.dirtyDay = today; p.cleanRun = 0; }
    else if (p.dirtyDay !== today && p.cleanRunDay !== today) {
      p.cleanRun = (p.cleanRunDay === prevDay(today) ? p.cleanRun || 0 : 0) + 1;
      p.cleanRunDay = today;
    }
    const streakUp = bumpStreak(p, now);
    const streakGems = awardStreakGems(p, now); // рубеж серии: 10, 20, 30… дней — алмазы
    const ach = checkAchievements(p, now);
    return { xp, boost: mult > 1 ? mult : null, gems, streakGems, firstTime, perfect: mistakes === 0, streak: p.streak, streakUp, levelUp: level(p.xp) > lvlBefore, level: level(p.xp), ach };
  }
  // Учёт ответа: решённые задачи с кодом и верные ответы нужны для ачивок и заданий
  function recordAnswer(p, q, correct, now) {
    if (correct && q.type === 'code') p.codeSolved = (p.codeSolved || 0) + 1;
    if (correct && now) questEvent(p, now, 'correct', 1);
    if (correct && now && q.type === 'code') questEvent(p, now, 'code', 1);
  }

  // ---------- Задания на день → сундуки с алмазами ----------
  // Каждый день у всех 3 задания из списка. За каждое — сундук, за все три — большой сундук.
  const QUESTS = [
    { id: 'lessons2', type: 'lessons', target: 2, ico: '📘', title: 'Пройди 2 урока', chest: 'common' },
    { id: 'lessons3', type: 'lessons', target: 3, ico: '📚', title: 'Пройди 3 урока', chest: 'rare' },
    { id: 'perfect1', type: 'perfect', target: 1, ico: '✨', title: 'Пройди урок без ошибок', chest: 'rare' },
    { id: 'correct15', type: 'correct', target: 15, ico: '✅', title: 'Ответь верно на 15 вопросов', chest: 'common' },
    { id: 'correct25', type: 'correct', target: 25, ico: '🎯', title: 'Ответь верно на 25 вопросов', chest: 'rare' },
    { id: 'code1', type: 'code', target: 1, ico: '💻', title: 'Реши задачу с кодом', chest: 'common' },
    { id: 'code2', type: 'code', target: 2, ico: '⌨️', title: 'Реши 2 задачи с кодом', chest: 'rare' },
    { id: 'xp30', type: 'xp', target: 30, ico: '⭐', title: 'Заработай 30 XP', chest: 'common' },
    { id: 'xp60', type: 'xp', target: 60, ico: '🌟', title: 'Заработай 60 XP', chest: 'rare' },
  ];
  // Сундуки как в Duolingo: 4 редкости. Сундук может «улучшиться» на ступень выше — это сюрприз при открытии.
  const RARITIES = ['common', 'rare', 'epic', 'legendary'];
  const QUEST_CHESTS = ['common', 'epic', 'legendary'];
  const CHESTS = {
    common: { name: 'Обычный', gems: [10, 25] },
    rare: { name: 'Редкий', gems: [25, 50] },
    epic: { name: 'Эпический', gems: [50, 100] },
    legendary: { name: 'Легендарный', gems: [100, 200] },
  };
  // Любой сундук, кроме легендарного, с шансом 25% улучшается на одну ступень
  const UPGRADE_CHANCE = 0.25;
  // Бустер опыта из сундука: чем реже сундук, тем чаще выпадает. Действует 15 минут.
  const BOOST_MIN = 15;
  const BOOST_CHANCE = { common: 0.2, rare: 0.3, epic: 0.45, legendary: 0.6 };
  function rollBoost(rarity, rnd) {
    if (!(rnd() < BOOST_CHANCE[rarity])) return null;
    const r = rnd();
    return r < 0.55 ? 1.5 : r < 0.88 ? 2 : 3; // x1.5 чаще всего, x3 — редкость
  }
  function rollChest(base, rnd = Math.random) {
    let k = Math.max(0, RARITIES.indexOf(base));
    if (k < RARITIES.length - 1 && rnd() < UPGRADE_CHANCE) k += 1;
    const rarity = RARITIES[Math.min(k, RARITIES.length - 1)];
    const [lo, hi] = CHESTS[rarity].gems;
    const got = { chest: rarity, gems: lo + Math.floor(rnd() * (hi - lo + 1)) };
    const boost = rollBoost(rarity, rnd);
    if (boost) got.boost = boost;
    return got;
  }
  const boostNow = (p, now) => (p.xpBoost && new Date(p.xpBoost.until) > now ? p.xpBoost.mult : 1);
  // Новый бустер: берём больший множитель, время — 15 минут с этого момента (или сколько осталось, если больше)
  function applyBoost(p, mult, now) {
    if (!mult) return;
    const cur = boostNow(p, now) > 1 ? p.xpBoost : null;
    const until = new Date(now.getTime() + BOOST_MIN * 60000);
    p.xpBoost = { mult: Math.max(mult, cur ? cur.mult : 1), until: (cur && new Date(cur.until) > until ? new Date(cur.until) : until).toISOString() };
  }
  function seeded(text) {
    let seed = 0;
    for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    return () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  }
  function questsFor(day) {
    const rnd = seeded('quests:' + day), out = [], types = new Set();
    while (out.length < 3) {
      const q = QUESTS[Math.floor(rnd() * QUESTS.length)];
      if (!types.has(q.type)) { types.add(q.type); out.push(q); } // три разных вида заданий
    }
    return out;
  }
  function questDay(p, now) {
    const day = mskDay(now);
    if (!p.quests || p.quests.day !== day) p.quests = { day, progress: {}, claimed: {} };
    return p.quests;
  }
  function questEvent(p, now, type, n) {
    const Q = questDay(p, now);
    Q.progress[type] = (Q.progress[type] || 0) + n;
  }
  function questStatus(p, now) {
    const Q = questDay(p, now);
    // Сундуки заданий дня: одно — обычный, одно — эпический, одно — легендарный
    const list = questsFor(Q.day).map((q, i) => {
      const have = Math.min(q.target, Q.progress[q.type] || 0);
      return { ...q, chest: QUEST_CHESTS[i], have, done: have >= q.target, claimed: !!Q.claimed[q.id] };
    });
    const allDone = list.every(q => q.done);
    return { day: Q.day, list, all: { done: allDone, claimed: !!Q.claimed.all } };
  }
  // Открыть сундук: id задания или 'all' — большой сундук за все три
  function claimQuest(p, now, id, rnd = Math.random) {
    const st = questStatus(p, now);
    let chest;
    if (id === 'all') { if (!st.all.done || st.all.claimed) return null; chest = 'epic'; }
    else {
      const q = st.list.find(x => x.id === id);
      if (!q || !q.done || q.claimed) return null;
      chest = q.chest;
    }
    const got = rollChest(chest, rnd);
    p.quests.claimed[id] = true;
    p.gems = (p.gems || 0) + got.gems;
    applyBoost(p, got.boost, now);
    return got;
  }

  // ---------- Алмазы за серию (как в Duolingo): каждые 10 дней огонька — алмазы сразу ----------
  // 10 дней → 50 💎, 20 → 100, 30 → 150 … (до 500). Каждый рубеж — один раз за всё время.
  const STREAK_STEP = 10;
  const streakGemsFor = n => Math.min(500, n * 5);
  // Сколько до следующей награды — для экрана
  function streakReward(p, now) {
    const s = currentStreak(p, now);
    const next = (Math.max(Math.floor(s / STREAK_STEP), Math.floor((p.streakChestMax || 0) / STREAK_STEP)) + 1) * STREAK_STEP;
    return { streak: s, next, nextGems: streakGemsFor(next) };
  }
  // Дошёл до нового рубежа — алмазы начисляются сами
  function awardStreakGems(p, now) {
    const n = Math.floor(currentStreak(p, now) / STREAK_STEP) * STREAK_STEP;
    if (n < STREAK_STEP || n <= (p.streakChestMax || 0)) return null;
    p.streakChestMax = n;
    const gems = streakGemsFor(n);
    p.gems = (p.gems || 0) + gems;
    return { n, gems };
  }

  // ---------- Алмазы: бесплатная сторона магазина ----------
  const GEM_SHOP = {
    heart: { title: '❤️ Одно сердце', description: 'Восстановить одну жизнь', gems: 100 },
    freeze: { title: '🧊 Заморозка серии', description: 'Пропустишь день — огонь не погаснет', gems: 400 },
  };
  function buyWithGems(p, item, now) {
    const it = GEM_SHOP[item];
    if (!it) return { error: 'no_item' };
    if ((p.gems || 0) < it.gems) return { error: 'no_gems' };
    if (item === 'heart') {
      refreshHearts(p, now);
      if (p.hearts >= MAX_HEARTS) return { error: 'full' };
      p.hearts++;
      if (p.hearts >= MAX_HEARTS) p.heartsAt = null;
    }
    if (item === 'freeze') p.freezes = (p.freezes || 0) + 1;
    p.gems -= it.gems;
    return { ok: true };
  }

  // ---------- Друзья и приглашения ----------
  // Пригласил друга → 1 день Плюса, когда друг позанимается 3 дня (просто перейти по ссылке мало)
  const REF_DAYS = 3, REF_PLUS_DAYS = 1;
  const referralReady = p => !!(p.referredBy && !p.refPaid && (p.activeDays || 0) >= REF_DAYS);
  function grantPlusDays(p, days, now) {
    const from = hasPlus(p, now) ? new Date(p.plusUntil) : now;
    p.plusUntil = new Date(from.getTime() + days * 86400000).toISOString();
    p.hearts = MAX_HEARTS; p.heartsAt = null;
  }
  const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих 0/O и 1/I
  function makeCode(rnd = Math.random, len = 6) { let s = ''; for (let k = 0; k < len; k++) s += CODE_ABC[Math.floor(rnd() * CODE_ABC.length)]; return s; }
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  // ---------- Дружеский забег (как «дружеская серия» в Duolingo) ----------
  // До 5 забегов. Забег продлевается на день, когда ОБА друга прошли хотя бы 1 урок.
  // Если день прошёл, а кто-то не занимался, — забег сгорает. На рубежах — сундуки обоим.
  const FSTREAK_MAX = 5;
  const FSTREAK_GOALS = [[3, 'common'], [7, 'rare'], [14, 'epic'], [30, 'legendary'], [50, 'legendary'], [100, 'legendary']];
  // Жив ли забег: последний день продления (или старт) — сегодня или вчера
  function fstreakAlive(s, today) {
    if (s.status === 'ended') return false;
    if (s.status === 'pending') return true;
    const base = s.last_day || s.start_day;
    return !!base && (base === today || base === prevDay(today));
  }
  // Ученик прошёл урок: отмечаем его сторону и продлеваем, если оба уже занимались сегодня
  function fstreakMark(s, side, today) {
    if (s.status !== 'active' || !fstreakAlive(s, today)) return false;
    s[side + '_day'] = today;
    if (s.a_day === today && s.b_day === today && s.last_day !== today) { s.days++; s.last_day = today; return true; }
    return false;
  }
  // Сундук, который сторона может забрать: самый высокий пройденный рубеж, который ещё не забирали
  function fstreakReward(s, side) {
    const got = s[side + '_reward'] || 0;
    const goal = FSTREAK_GOALS.filter(([n]) => n <= s.days && n > got).pop();
    return goal ? { n: goal[0], chest: goal[1] } : null;
  }
  const fstreakNext = days => (FSTREAK_GOALS.find(([n]) => n > days) || [null])[0];

  // ---------- Ачивки ----------
  const doneCount = p => Object.values(p.done || {}).filter(d => !d.skipped).length;
  const ACHIEVEMENTS = [
    { id: 'first_lesson', ico: '🎉', title: 'Первый урок', desc: 'Пройди первый урок', test: p => doneCount(p) >= 1 },
    { id: 'first_code', ico: '💻', title: 'Первый код', desc: 'Реши первую задачу с кодом', test: p => (p.codeSolved || 0) >= 1 },
    { id: 'perfect', ico: '✨', title: 'Без ошибок', desc: 'Пройди урок без единой ошибки', test: p => Object.values(p.done || {}).some(d => d.best === 0 && !d.skipped) },
    { id: 'streak3', ico: '🔥', title: 'Разогрев', desc: 'Учись 3 дня подряд', test: p => (p.bestStreak || 0) >= 3 },
    { id: 'lessons10', ico: '📚', title: 'Книжный червь', desc: 'Пройди 10 уроков', test: p => doneCount(p) >= 10 },
    { id: 'streak7', ico: '📅', title: 'Неделя подряд', desc: 'Учись 7 дней подряд', test: p => (p.bestStreak || 0) >= 7 },
    { id: 'clean_week', ico: '💎', title: 'Неделя без ошибок', desc: '7 дней подряд — все уроки без ошибок', test: p => (p.cleanRun || 0) >= 7 },
    { id: 'code25', ico: '⌨️', title: 'Кодер', desc: 'Реши 25 задач с кодом', test: p => (p.codeSolved || 0) >= 25 },
    { id: 'level10', ico: '⭐', title: 'Уровень 10', desc: 'Набери 10-й уровень', test: p => level(p.xp) >= 10 },
    { id: 'lessons50', ico: '🎓', title: 'Полсотни', desc: 'Пройди 50 уроков', test: p => doneCount(p) >= 50 },
    { id: 'streak30', ico: '🏆', title: 'Месяц подряд', desc: 'Учись 30 дней подряд', test: p => (p.bestStreak || 0) >= 30 },
    { id: 'lessons100', ico: '🏛️', title: 'Сотня', desc: 'Пройди 100 уроков', test: p => doneCount(p) >= 100 },
    { id: 'code100', ico: '🤖', title: 'Машина кода', desc: 'Реши 100 задач с кодом', test: p => (p.codeSolved || 0) >= 100 },
  ];
  // Новые ачивки: отмечаем в p.ach и возвращаем список для праздника на экране
  function checkAchievements(p, now) {
    p.ach = p.ach || {};
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (!p.ach[a.id] && a.test(p)) { p.ach[a.id] = mskDay(now); got.push({ id: a.id, ico: a.ico, title: a.title }); }
    }
    return got;
  }

  // ---------- Ежедневный бонус ----------
  // Заходи каждый день: награда растёт 7 дней по кругу, на 7-й день — заморозка серии
  const DAILY_XP = [5, 5, 10, 10, 15, 15, 30];
  const dailyAvailable = (p, now) => p.dailyDay !== mskDay(now);
  // Какой день по счёту будет, если забрать бонус сейчас (1…7)
  function dailyNextDay(p, now) {
    const run = p.dailyDay === prevDay(mskDay(now)) ? (p.dailyRun || 0) + 1 : 1;
    return ((run - 1) % 7) + 1;
  }
  function claimDaily(p, now) {
    const today = mskDay(now);
    if (p.dailyDay === today) return null;
    p.dailyRun = p.dailyDay === prevDay(today) ? (p.dailyRun || 0) + 1 : 1;
    p.dailyDay = today;
    const day = ((p.dailyRun - 1) % 7) + 1;
    const xp = DAILY_XP[day - 1];
    p.xp += xp;
    questEvent(p, now, 'xp', xp);
    const freeze = day === 7;
    if (freeze) p.freezes = (p.freezes || 0) + 1;
    return { day, xp, freeze, ach: checkAchievements(p, now) };
  }

  // ---------- Магазин и Плюс ----------
  const SHOP = {
    hearts: { title: '❤️ Все жизни сразу', description: 'Мгновенно восстанавливает все 5 жизней', stars: 10 },
    freeze: { title: '🧊 Заморозка серии', description: 'Пропустишь один день — серия не сгорит', stars: 15 },
    plus_week: { title: '👑 Питоша Плюс на неделю', description: 'Безлимит жизней и темы на 7 дней', stars: 25, plusDays: 7 },
    plus: { title: '👑 Питоша Плюс на месяц', description: 'Безлимит жизней и темы на 30 дней', stars: 75, plusDays: 30 },
    plus_year: { title: '👑 Питоша Плюс на год', description: 'Безлимит жизней и темы на 365 дней', stars: 499, plusDays: 365 },
    plus_promo: { title: '🎁 Плюс на месяц — акция', description: 'Для первых 100 учеников: месяц Плюса со скидкой', stars: 50, plusDays: 30 },
  };
  const PROMO_LIMIT = 100;
  function applyItem(p, item, now) {
    const it = SHOP[item];
    if (!it) return false;
    if (item === 'hearts') { p.hearts = MAX_HEARTS; p.heartsAt = null; }
    if (item === 'freeze') p.freezes = (p.freezes || 0) + 1;
    if (it.plusDays) {
      const from = hasPlus(p, now) ? new Date(p.plusUntil) : now;
      p.plusUntil = new Date(from.getTime() + it.plusDays * 86400000).toISOString();
      p.hearts = MAX_HEARTS; p.heartsAt = null;
      if (item === 'plus_promo') p.promoUsed = true;
    }
    return true;
  }
  const plusDaysLeft = (p, now) => (hasPlus(p, now) ? Math.ceil((new Date(p.plusUntil) - now) / 86400000) : 0);

  // ---------- Вступительный тест: «знаю основы» ----------
  // По одному вопросу «что выведет код» из первых PLACEMENT_UNITS разделов. Пропускаем разделы,
  // на которые ответил верно подряд с самого начала (угадать подряд много — трудно).
  const PLACEMENT_UNITS = 8;
  function placementQuestions(units) {
    return units.slice(0, PLACEMENT_UNITS).map(u => {
      for (const l of u.lessons) {
        const q = l.questions.find(x => x.type === 'output' && x.options);
        if (q) return { unit: u.id, lesson: l.id, qi: l.questions.indexOf(q), q };
      }
      return null;
    }).filter(Boolean);
  }
  function applyPlacement(p, units, answers) {
    if (p.placed || doneCount(p) > 0) return { skipped: 0 };
    const qs = placementQuestions(units);
    let k = 0;
    while (k < qs.length && answers && Number(answers[k]) === 0 && answers[k] !== null) k++;
    for (const u of units.slice(0, k)) for (const l of u.lessons) if (!p.done[l.id]) p.done[l.id] = { best: 0, times: 0, skipped: true };
    p.placed = true;
    return { skipped: k };
  }

  // ---------- Языки программирования ----------
  // Прогресс, опыт, огонёк, алмазы и Плюс — общие. У каждого языка своя дорожка уроков (id уроков с префиксом языка).
  const LANGS = [
    { id: 'python', name: 'Python', ico: '🐍', sandbox: true, prefix: '', about: 'Самый популярный язык: боты, игры, нейросети' },
    { id: 'js', name: 'JavaScript', ico: '⚡', sandbox: true, prefix: 'js-', about: 'Сайты, браузерные игры и приложения' },
    { id: 'html', name: 'HTML и CSS', ico: '🎨', sandbox: true, prefix: 'html-', about: 'Свои сайты и красивые странички' },
    { id: 'lua', name: 'Lua для Roblox', ico: '🎮', sandbox: true, prefix: 'lua-', about: 'Скрипты для своих игр в Roblox' },
    { id: 'sql', name: 'SQL', ico: '🗃️', sandbox: false, prefix: 'sql-', about: 'Базы данных — память любых приложений' },
    { id: 'cs', name: 'C#', ico: '🎯', sandbox: false, prefix: 'cs-', about: 'Игры в Unity и программы для Windows' },
    { id: 'cpp', name: 'C++', ico: '⚙️', sandbox: false, prefix: 'cpp-', about: 'Быстрые программы и олимпиады' },
  ];
  const cleanLang = l => (LANGS.some(x => x.id === l) ? l : 'python');
  const langInfo = l => LANGS.find(x => x.id === cleanLang(l));
  // Язык урока — по префиксу id (у Python префикса нет)
  const lessonLang = id => (LANGS.find(x => x.prefix && String(id).startsWith(x.prefix)) || LANGS[0]).id;

  // ---------- Профиль: аватарка и имя для рейтинга ----------
  const AVATARS = ['🐍', '🦊', '🐼', '🐯', '🐸', '🐵', '🦁', '🐨', '🐙', '🦄', '🐲', '🤖', '👾', '🦖', '🐧', '🐺', '😎', '🥷', '🧙', '👽', '🐱', '🐶', '🦉', '🚀'];
  // Корни грубых слов — такие имена в рейтинге не пропускаем
  const BAD = ['хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'ебал', 'еблан', 'бля', 'сука', 'суки', 'мудак', 'мудил', 'пидор', 'пидр', 'гандон', 'долбо', 'шлюх', 'залуп', 'дрочи', 'член', 'жоп',
    'fuck', 'shit', 'bitch', 'dick', 'pussy', 'nigg', 'cunt', 'porn', 'sex', 'секс', 'порн', 'нацист', 'гитлер', 'hitler'];
  function cleanName(raw) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2) return { ok: false, error: 'Имя слишком короткое — минимум 2 символа' };
    if (name.length > 16) return { ok: false, error: 'Имя слишком длинное — максимум 16 символов' };
    if (!/^[A-Za-zА-Яа-яЁё0-9 _.\-]+$/.test(name)) return { ok: false, error: 'Можно только буквы, цифры, пробел, точку, - и _' };
    const flat = name.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '')
      .replace(/0/g, 'о').replace(/3/g, 'з').replace(/4/g, 'ч').replace(/@/g, 'а');
    if (BAD.some(b => flat.includes(b.replace(/ё/g, 'е')))) return { ok: false, error: 'Такое имя нельзя — придумай другое' };
    return { ok: true, name };
  }
  // Своё фото: маленькая картинка data:image/…;base64 (приложение сжимает её до 128×128).
  // Проверяем формат, размер и «подпись» файла — чтобы под видом картинки не прислали что-то другое.
  const PHOTO_MAX = 20000; // символов data URL ≈ 15 КБ
  const PHOTO_MAGIC = { jpeg: [[0, '\xFF\xD8\xFF']], png: [[0, '\x89PNG']], webp: [[0, 'RIFF'], [8, 'WEBP']] };
  function isPhoto(a) {
    if (typeof a !== 'string' || a.length > PHOTO_MAX) return false;
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(a);
    if (!m || m[2].length % 4 !== 0) return false;
    let head;
    try { head = atob(m[2].slice(0, 16)); } catch (e) { return false; }
    return PHOTO_MAGIC[m[1]].every(([at, sig]) => head.slice(at, at + sig.length) === sig);
  }
  const cleanAvatar = a => (AVATARS.includes(a) || isPhoto(a) ? a : AVATARS[0]);

  const api = {
    MAX_HEARTS, HEART_MIN, XP_PER_LEVEL, mskDay, prevDay, newPlayer, hasPlus,
    refreshHearts, loseHeart, nextHeartMs, currentStreak, bumpStreak, level, levelProgress, lessonXp,
    isUnlocked, norm, checkAnswer, rightAnswer, finishLesson, AVATARS, cleanName, cleanAvatar, isPhoto, PHOTO_MAX,
    recordAnswer, doneCount, ACHIEVEMENTS, checkAchievements,
    DAILY_XP, dailyAvailable, dailyNextDay, claimDaily,
    SHOP, PROMO_LIMIT, applyItem, plusDaysLeft,
    PLACEMENT_UNITS, placementQuestions, applyPlacement,
    NEWBIE_DAYS, ensureStart, newbieDaysLeft, isNewbie, unlimitedHearts,
    QUESTS, CHESTS, questsFor, questEvent, questStatus, claimQuest,
    GEM_SHOP, buyWithGems, STREAK_STEP, streakReward, awardStreakGems,
    REF_DAYS, REF_PLUS_DAYS, referralReady, grantPlusDays, makeCode, cleanCode,
    LANGS, cleanLang, langInfo, lessonLang,
    RARITIES, QUEST_CHESTS, UPGRADE_CHANCE, rollChest, BOOST_MIN, BOOST_CHANCE, boostNow, applyBoost, FSTREAK_MAX, FSTREAK_GOALS, fstreakAlive, fstreakMark, fstreakReward, fstreakNext,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CORE = api;
})(typeof self !== 'undefined' ? self : this);
