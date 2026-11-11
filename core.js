// Правила игры Питоши — общие для мини-приложения и сервера (чтобы считали одинаково).
// Всё — чистые функции над объектом ученика: { xp, hearts, heartsAt, streak, bestStreak, lastDay, done }.
(function (root) {
  const MAX_HEARTS = 5;
  const HEART_MIN = 48;            // новая жизнь каждые 48 минут (5 жизней ≈ 4 часа)
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

  // Завершить урок: ответы → опыт, серия, отметка «пройден»
  function finishLesson(p, lesson, { correct, mistakes }, now) {
    const firstTime = !p.done[lesson.id];
    const xp = lessonXp({ firstTime, correct, mistakes });
    const lvlBefore = level(p.xp);
    p.xp += xp;
    const prev = p.done[lesson.id];
    p.done[lesson.id] = { best: prev ? Math.min(prev.best, mistakes) : mistakes, times: (prev ? prev.times : 0) + 1 };
    const streakUp = bumpStreak(p, now);
    return { xp, firstTime, perfect: mistakes === 0, streak: p.streak, streakUp, levelUp: level(p.xp) > lvlBefore, level: level(p.xp) };
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
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CORE = api;
})(typeof self !== 'undefined' ? self : this);
