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
      gemBuy: item => post('/gem_buy', { item }),
      questClaim: id => post('/quest_claim', { id }),
      streakChest: () => post('/streak_chest'),
      friends: () => post('/friends'),
      friendAdd: code => post('/friend_add', { code }),
      friendRemove: id => post('/friend_remove', { id }),
      raceStart: friendId => post('/race_start', { friendId }),
      raceClaim: raceId => post('/race_claim', { raceId }),
      snippetSave: code => post('/snippet_save', { code }),
      snippets: () => post('/snippets'),
      snippetGet: id => post('/snippet_get', { id }),
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
      C.ensureStart(data.player, now);
      if (!data.player.friendCode) data.player.friendCode = C.makeCode();
      C.refreshHearts(data.player, now);
      return {
        ...data.player, name: (data.player.profile && data.player.profile.name) || user.first_name, streakNow: C.currentStreak(data.player, now), nextHeartMs: C.nextHeartMs(data.player, now),
        plus: C.hasPlus(data.player, now), plusDays: C.plusDaysLeft(data.player, now),
        daily: C.dailyAvailable(data.player, now) ? { day: C.dailyNextDay(data.player, now) } : null,
        session: data.session ? { lesson: data.session.lesson, i: data.session.i } : null,
        today: C.mskDay(now),
        gems: data.player.gems || 0, newbieDays: C.newbieDaysLeft(data.player, now),
        quests: C.questStatus(data.player, now), refLink: 'https://t.me/pythonshkabot?start=ref_demo',
        streakChest: C.streakChest(data.player, now),
      };
    };
    // Демо-друзья и забеги — чтобы посмотреть экран без сервера
    data.friends = data.friends || [{ id: 1, name: 'Алиса', avatar: '🦊', xp: 340, streak: 5 }, { id: 2, name: 'Тимур', avatar: '🐯', xp: 210, streak: 2 }];
    data.races = data.races || [];
    data.snippets = data.snippets || [];
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
      answer(lessonId, qi, answer) {
        const s = data.session;
        if (!s || s.lesson !== lessonId || s.i !== qi) return ok({ error: 'stale' });
        const lesson = lessonById(lessonId);
        const q = lesson.questions[qi];
        const now = new Date();
        const correct = answer !== null && C.checkAnswer(q, answer);
        C.recordAnswer(data.player, q, correct, now);
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
      gemBuy(item) {
        const res = C.buyWithGems(data.player, item, new Date());
        if (!res.error) save();
        return ok({ ...res, player: view() });
      },
      streakChest() {
        const got = C.claimStreakChest(data.player, new Date());
        if (!got) return ok({ error: 'not_ready', player: view() });
        save();
        return ok({ chest: got, player: view() });
      },
      questClaim(id) {
        const got = C.claimQuest(data.player, new Date(), id);
        if (!got) return ok({ error: 'not_ready', player: view() });
        save();
        return ok({ chest: got, player: view() });
      },
      friends() {
        const now = new Date();
        const races = data.races.map(x => {
          const o = data.friends.find(f => f.id === x.friend) || {};
          const mine = data.player.xp - x.startXp, theirs = x.theirs;
          return { id: x.id, opponent: { id: o.id, name: o.name, avatar: o.avatar }, mine, theirs, endsAt: x.endsAt, finished: new Date(x.endsAt) <= now, claimed: !!x.claimed, result: mine > theirs ? 'win' : mine < theirs ? 'lose' : 'draw' };
        });
        return ok({ friends: data.friends, races, code: data.player.friendCode, refLink: view().refLink, refRewards: data.player.refRewards || 0, player: view() });
      },
      friendAdd(code) {
        const c = C.cleanCode(code);
        if (c.length < 4) return ok({ error: 'bad_code' });
        if (c === data.player.friendCode) return ok({ error: 'self' });
        if (c !== 'SONYA1') return ok({ error: 'not_found' });
        if (!data.friends.some(f => f.id === 3)) data.friends.push({ id: 3, name: 'Соня', avatar: '🦄', xp: 120, streak: 1 });
        save();
        return ok({ ok: true, name: 'Соня' });
      },
      friendRemove(id) { data.friends = data.friends.filter(f => f.id !== id); save(); return ok({ ok: true }); },
      raceStart(friendId) {
        if (data.races.some(x => x.friend === friendId && new Date(x.endsAt) > new Date())) return ok({ error: 'already' });
        data.races.unshift({ id: Date.now(), friend: friendId, startXp: data.player.xp, theirs: 0, endsAt: new Date(Date.now() + C.RACE_DAYS * 86400000).toISOString() });
        save();
        return ok({ ok: true });
      },
      raceClaim(raceId) {
        const x = data.races.find(r => r.id === raceId);
        if (!x || x.claimed || new Date(x.endsAt) > new Date()) return ok({ error: 'not_ready' });
        const mine = data.player.xp - x.startXp;
        const gems = mine > x.theirs ? C.RACE_PRIZE : mine === x.theirs ? C.RACE_PRIZE_DRAW : 10;
        x.claimed = true; data.player.gems = (data.player.gems || 0) + gems; save();
        return ok({ gems, result: mine > x.theirs ? 'win' : mine === x.theirs ? 'draw' : 'lose', player: view() });
      },
      snippetSave(code) {
        if (!String(code || '').trim()) return ok({ error: 'empty' });
        const id = C.makeCode(Math.random, 8);
        data.snippets.unshift({ id, code, at: new Date().toISOString() }); save();
        return ok({ id, link: 'https://t.me/pythonshkabot?start=code_' + id });
      },
      snippets: () => ok({ list: data.snippets.slice(0, 20).map(s => ({ id: s.id, preview: s.code.split('\n')[0].slice(0, 60), at: s.at, link: 'https://t.me/pythonshkabot?start=code_' + s.id })) }),
      snippetGet(id) {
        const s = data.snippets.find(x => x.id === C.cleanCode(id));
        return ok(s ? { id: s.id, code: s.code, author: view().name, mine: true } : { error: 'not_found' });
      },
      profile(name, avatar) {
        const c = C.cleanName(name);
        if (!c.ok) return ok({ error: 'bad_name', message: c.error });
        data.player.profile = { name: c.name, avatar: C.cleanAvatar(avatar) };
        save();
        return ok({ player: view() });
      },
      reset() { data = { player: C.newPlayer(), session: null, friends: [], races: [], snippets: [] }; save(); },
    };
  }

  root.API = cfg.API_URL ? remote(cfg.API_URL.replace(/\/$/, '')) : local();
})(typeof self !== 'undefined' ? self : this);
