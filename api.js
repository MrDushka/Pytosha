// Связь приложения с сервером. Если сервер не указан (API_URL пустой) — демо-режим:
// те же правила (core.js), но прогресс хранится только в этом браузере.
(function (root) {
  const { LESSONS, lessonById, lessonIndex } = root.COURSE; // UNITS берём из root.COURSE там, где нужен
  const C = root.CORE;
  const cfg = root.PITOSHA_CONFIG || {};
  const tg = root.Telegram && root.Telegram.WebApp;

  // ---------- Сервер (Supabase) ----------
  function remote(url) {
    async function post(path, body) {
      const res = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': (tg && tg.initData) || '' },
        body: JSON.stringify(body || {}),
      });
      const j = await res.json().catch(() => ({ error: 'bad_response' }));
      if (!res.ok && !j.error) j.error = 'http_' + res.status;
      return j;
    }
    return {
      demo: false,
      state: () => post('/state'),
      start: (lessonId, restart) => post('/start', { lessonId, restart: !!restart }),
      answer: (lessonId, qi, answer) => post('/answer', { lessonId, qi, answer }),
      top: () => post('/top'),
      buy: item => post('/buy', { item }),
      profile: (name, avatar) => post('/profile', { name, avatar }),
      daily: () => post('/daily'),
      placement: answers => post('/placement', { answers }),
      arenaStart: () => post('/arena_start'),
      arenaFinish: answers => post('/arena_finish', { answers }),
      arenaTop: () => post('/arena_top'),
    };
  }

  // ---------- Демо (в браузере) ----------
  function local() {
    const KEY = 'pitosha-demo-v1';
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
    if (!data) data = { player: C.newPlayer(), session: null };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* приватный режим */ } };
    const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || { first_name: 'Ученик', id: 0 };
    const view = () => {
      const now = new Date();
      C.refreshHearts(data.player, now);
      return {
        ...data.player, name: (data.player.profile && data.player.profile.name) || user.first_name, streakNow: C.currentStreak(data.player, now), nextHeartMs: C.nextHeartMs(data.player, now),
        plus: C.hasPlus(data.player, now), plusDays: C.plusDaysLeft(data.player, now),
        daily: C.dailyAvailable(data.player, now) ? { day: C.dailyNextDay(data.player, now) } : null,
        session: data.session ? { lesson: data.session.lesson, i: data.session.i } : null,
        today: C.mskDay(now),
      };
    };
    const ok = x => Promise.resolve(x);
    return {
      demo: true,
      state: () => ok({ player: view(), promo: { left: data.player.promoUsed ? 0 : 73, available: !data.player.promoUsed } }),
      start(lessonId, restart) {
        const i = lessonIndex(lessonId);
        if (i < 0) return ok({ error: 'no_lesson' });
        if (!C.isUnlocked(data.player, LESSONS, i)) return ok({ error: 'locked' });
        C.refreshHearts(data.player, new Date());
        if (data.player.hearts <= 0) return ok({ error: 'no_hearts', player: view() });
        const s = data.session;
        if (s && s.lesson === lessonId && s.i > 0 && s.i < LESSONS[i].questions.length && !restart) return ok({ player: view(), resume: { i: s.i, correct: s.correct } });
        data.session = { lesson: lessonId, i: 0, correct: 0, mistakes: 0 };
        save();
        return ok({ player: view() });
      },
      daily() {
        const got = C.claimDaily(data.player, new Date());
        if (!got) return ok({ error: 'already', player: view() });
        save();
        return ok({ daily: got, player: view() });
      },
      placement(answers) {
        const res = C.applyPlacement(data.player, root.COURSE.UNITS, answers);
        save();
        return ok({ ...res, player: view() });
      },
      arenaStart() {
        const now = new Date(), day = C.mskDay(now), a = data.player.arena;
        if (a && a.day === day && a.done) return ok({ error: 'played', result: a, player: view() });
        if (!a || a.day !== day || !a.startedAt) { data.player.arena = { day, startedAt: now.toISOString() }; save(); }
        return ok({ day, startedAt: data.player.arena.startedAt, now: now.toISOString(), player: view() });
      },
      arenaFinish(answers) {
        const now = new Date(), a = data.player.arena;
        if (!a || !a.startedAt || a.done) return ok({ error: 'no_arena' });
        const score = C.arenaScore(LESSONS, a.day, answers, now - new Date(a.startedAt));
        const ach = C.finishArena(data.player, a.day, score, now);
        save();
        return ok({ score, ach, player: view() });
      },
      arenaTop() {
        const a = data.player.arena;
        const me = a && a.done && a.day === C.mskDay(new Date()) ? [{ name: view().name, avatar: (data.player.profile || {}).avatar || '🐍', correct: a.correct, ms: a.ms, me: true }] : [];
        const top = [{ name: 'Алиса', avatar: '🦊', correct: 5, ms: 21400 }, { name: 'Тимур', avatar: '🐯', correct: 4, ms: 30100 }, { name: 'Соня', avatar: '🦄', correct: 3, ms: 41000 }]
          .concat(me).sort((x, y) => y.correct - x.correct || x.ms - y.ms);
        return ok({ day: C.mskDay(new Date()), top });
      },
      answer(lessonId, qi, answer) {
        const s = data.session;
        if (!s || s.lesson !== lessonId || s.i !== qi) return ok({ error: 'stale' });
        const lesson = lessonById(lessonId);
        const q = lesson.questions[qi];
        const now = new Date();
        const correct = answer !== null && C.checkAnswer(q, answer);
        C.recordAnswer(data.player, q, correct);
        if (correct) s.correct++; else { s.mistakes++; C.loseHeart(data.player, now); }
        s.i++;
        let finished = null, failed = false;
        if (!correct && data.player.hearts <= 0) { failed = true; data.session = null; }
        else if (s.i >= lesson.questions.length) { finished = C.finishLesson(data.player, lesson, s, now); data.session = null; }
        save();
        return ok({ correct, right: C.rightAnswer(q), explain: q.explain, finished, failed, player: view() });
      },
      top: () => ok({ top: [
        { name: 'Алиса', avatar: '🦊', xp: 340 }, { name: 'Тимур', avatar: '🐯', xp: 210 }, { name: 'Соня', avatar: '🦄', xp: 120 },
        { name: view().name, avatar: (data.player.profile || {}).avatar || '🐍', xp: data.player.xp, me: true }, { name: 'Макс', avatar: '🤖', xp: 40 },
      ].sort((a, b) => b.xp - a.xp) }),
      buy: () => ok({ error: 'demo' }),
      profile(name, avatar) {
        const c = C.cleanName(name);
        if (!c.ok) return ok({ error: 'bad_name', message: c.error });
        data.player.profile = { name: c.name, avatar: C.cleanAvatar(avatar) };
        save();
        return ok({ player: view() });
      },
      reset() { data = { player: C.newPlayer(), session: null }; save(); },
    };
  }

  root.API = cfg.API_URL ? remote(cfg.API_URL.replace(/\/$/, '')) : local();
})(typeof self !== 'undefined' ? self : this);
