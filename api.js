// Связь приложения с сервером. Если сервер не указан (API_URL пустой) — демо-режим:
// те же правила (core.js), но прогресс хранится только в этом браузере.
(function (root) {
  const { LESSONS, lessonById, lessonIndex } = root.COURSE;
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
      start: lessonId => post('/start', { lessonId }),
      answer: (lessonId, qi, answer) => post('/answer', { lessonId, qi, answer }),
      top: () => post('/top'),
      buy: item => post('/buy', { item }),
      profile: (name, avatar) => post('/profile', { name, avatar }),
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
      return { ...data.player, name: (data.player.profile && data.player.profile.name) || user.first_name, streakNow: C.currentStreak(data.player, now), nextHeartMs: C.nextHeartMs(data.player, now), plus: C.hasPlus(data.player, now) };
    };
    const ok = x => Promise.resolve(x);
    return {
      demo: true,
      state: () => ok({ player: view() }),
      start(lessonId) {
        const i = lessonIndex(lessonId);
        if (i < 0) return ok({ error: 'no_lesson' });
        if (!C.isUnlocked(data.player, LESSONS, i)) return ok({ error: 'locked' });
        C.refreshHearts(data.player, new Date());
        if (data.player.hearts <= 0) return ok({ error: 'no_hearts', player: view() });
        data.session = { lesson: lessonId, i: 0, correct: 0, mistakes: 0 };
        save();
        return ok({ player: view() });
      },
      answer(lessonId, qi, answer) {
        const s = data.session;
        if (!s || s.lesson !== lessonId || s.i !== qi) return ok({ error: 'stale' });
        const lesson = lessonById(lessonId);
        const q = lesson.questions[qi];
        const now = new Date();
        const correct = answer !== null && C.checkAnswer(q, answer);
        if (correct) s.correct++; else { s.mistakes++; C.loseHeart(data.player, now); }
        s.i++;
        let finished = null, failed = false;
        if (!correct && data.player.hearts <= 0) { failed = true; data.session = null; }
        else if (s.i >= lesson.questions.length) { finished = C.finishLesson(data.player, lesson, s, now); data.session = null; }
        save();
        return ok({ correct, right: q.type === 'input' ? q.answers[0] : q.options[0], explain: q.explain, finished, failed, player: view() });
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
