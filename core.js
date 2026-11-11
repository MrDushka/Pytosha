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

  // ---------- Жизни ----------
  function refreshHearts(p, now) {
    if (hasPlus(p, now)) { p.hearts = MAX_HEARTS; p.heartsAt = null; return p; }
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
    if (hasPlus(p, now)) return p;
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

  // Завершить урок: ответы → опыт, серия, отметка «пройден», ачивки
  function finishLesson(p, lesson, { correct, mistakes }, now) {
    const firstTime = !p.done[lesson.id] || !!p.done[lesson.id].skipped;
    const xp = lessonXp({ firstTime, correct, mistakes });
    const lvlBefore = level(p.xp);
    p.xp += xp;
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
    const ach = checkAchievements(p, now);
    return { xp, firstTime, perfect: mistakes === 0, streak: p.streak, streakUp, levelUp: level(p.xp) > lvlBefore, level: level(p.xp), ach };
  }
  // Учёт ответа: решённые задачи с кодом нужны для ачивок
  function recordAnswer(p, q, correct) {
    if (correct && q.type === 'code') p.codeSolved = (p.codeSolved || 0) + 1;
  }

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
    { id: 'arena', ico: '⚔️', title: 'Гладиатор', desc: 'Сыграй на арене', test: p => (p.arenaPlayed || 0) >= 1 },
    { id: 'arena_perfect', ico: '⚡', title: 'Молния', desc: 'Ответь на арене на все вопросы верно', test: p => (p.arenaBest || 0) >= ARENA_SIZE },
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
    const freeze = day === 7;
    if (freeze) p.freezes = (p.freezes || 0) + 1;
    return { day, xp, freeze, ach: checkAchievements(p, now) };
  }

  // ---------- Магазин и Плюс ----------
  const SHOP = {
    hearts: { title: '❤️ Все жизни сразу', description: 'Мгновенно восстанавливает все 5 жизней', stars: 10 },
    freeze: { title: '🧊 Заморозка серии', description: 'Пропустишь один день — серия не сгорит', stars: 15 },
    plus_week: { title: '👑 Питоша Плюс на неделю', description: 'Безлимит жизней, песочница и темы на 7 дней', stars: 25, plusDays: 7 },
    plus: { title: '👑 Питоша Плюс на месяц', description: 'Безлимит жизней, песочница и темы на 30 дней', stars: 75, plusDays: 30 },
    plus_year: { title: '👑 Питоша Плюс на год', description: 'Безлимит жизней, песочница и темы на 365 дней', stars: 499, plusDays: 365 },
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

  // ---------- Арена: 5 вопросов за 60 секунд, у всех в этот день одни и те же ----------
  const ARENA_SIZE = 5;
  const ARENA_MS = 60000;
  function arenaQuestions(lessons, day) {
    const basics = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11']);
    const pool = [];
    for (const l of lessons) {
      if (!basics.has(l.unit)) continue;
      l.questions.forEach((q, qi) => { if (q.type === 'output' && q.options && q.code) pool.push({ lesson: l.id, qi, q }); });
    }
    let seed = 0;
    for (const ch of 'arena:' + day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    const out = [], used = new Set();
    while (out.length < Math.min(ARENA_SIZE, pool.length)) {
      const k = Math.floor(rnd() * pool.length);
      if (!used.has(k)) { used.add(k); out.push(pool[k]); }
    }
    return out;
  }
  // Итог арены: верные ответы и время (не больше лимита + 5 секунд на связь)
  function arenaScore(lessons, day, answers, ms) {
    const qs = arenaQuestions(lessons, day);
    const correct = qs.filter((x, k) => answers && answers[k] !== null && answers[k] !== undefined && Number(answers[k]) === 0).length;
    return { correct, ms: Math.max(0, Math.min(Math.round(ms), ARENA_MS + 5000)), xp: correct * 2 };
  }
  function finishArena(p, day, score, now) {
    p.arena = { day, done: true, correct: score.correct, ms: score.ms };
    p.arenaPlayed = (p.arenaPlayed || 0) + 1;
    p.arenaBest = Math.max(p.arenaBest || 0, score.correct);
    p.xp += score.xp;
    return checkAchievements(p, now);
  }

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
    ARENA_SIZE, ARENA_MS, arenaQuestions, arenaScore, finishArena,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CORE = api;
})(typeof self !== 'undefined' ? self : this);
