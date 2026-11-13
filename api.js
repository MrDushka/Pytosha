// Связь приложения с сервером. Если сервер не указан (API_URL пустой) — демо-режим:
// те же правила (core.js), но прогресс хранится только в этом браузере.
(function (root) {
  // Урок может быть любого языка: курс находим по префиксу id (у Python префикса нет)
  const courseOf = id => { const l = root.CORE.lessonLang(id); return l === 'python' ? root.COURSE : ((root.COURSES || {})[l] || root.COURSE); };
  const lessonById = id => courseOf(id).lessonById(id);
  const lessonIndex = id => courseOf(id).lessonIndex(id);
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
      friends: () => post('/friends'),
      admin: () => post('/admin'),
      friendSearch: q => post('/friend_search', { q }),
      follow: id => post('/follow', { id }),
      unfollow: id => post('/unfollow', { id }),
      streakInvite: id => post('/streak_invite', { id }),
      streakAccept: id => post('/streak_accept', { id }),
      streakDecline: id => post('/streak_decline', { id }),
      streakEnd: id => post('/streak_end', { id }),
      streakClaim: id => post('/streak_claim', { id }),
      snippetSave: (code, lang) => post('/snippet_save', { code, lang }),
      setLang: lang => post('/set_lang', { lang }),
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
      C.refreshHearts(data.player, now);
      return {
        ...data.player, name: (data.player.profile && data.player.profile.name) || user.first_name, streakNow: C.currentStreak(data.player, now), nextHeartMs: C.nextHeartMs(data.player, now),
        plus: C.hasPlus(data.player, now), plusDays: C.plusDaysLeft(data.player, now),
        daily: C.dailyAvailable(data.player, now) ? { day: C.dailyNextDay(data.player, now) } : null,
        session: data.session ? { lesson: data.session.lesson, i: data.session.i } : null,
        today: C.mskDay(now),
        gems: data.player.gems || 0, newbieDays: C.newbieDaysLeft(data.player, now),
        quests: C.questStatus(data.player, now), refLink: 'https://t.me/pythonshkabot?start=ref_demo',
        streakReward: C.streakReward(data.player, now),
        boost: C.boostNow(data.player, now) > 1 ? { mult: C.boostNow(data.player, now), until: data.player.xpBoost.until } : null,
      };
    };
    // Демо-друзья и забеги — чтобы посмотреть экран без сервера. Я в забеге — сторона «a», друг — «b».
    data.people = data.people || [{ id: 1, name: 'Алиса', username: 'alisa_py', avatar: '🦊', xp: 340, streak: 5 }, { id: 2, name: 'Тимур', username: 'timur', avatar: '🐯', xp: 210, streak: 2 },
      { id: 3, name: 'Соня', username: 'sonya', avatar: '🦄', xp: 120, streak: 1 }, { id: 4, name: 'Макс', username: 'max_code', avatar: '🤖', xp: 40, streak: 0 }];
    data.following = data.following || [1, 2];
    data.followers = data.followers || [1, 2, 3];
    data.fstreaks = data.fstreaks || [{ id: 1, friend: 1, status: 'pending', days: 0, a_reward: 0, b_reward: 0, invitedByMe: false }];
    const relation = id => (data.following.includes(id) && data.followers.includes(id) ? 'friend' : data.following.includes(id) ? 'following' : data.followers.includes(id) ? 'follower' : 'none');
    function demoFriends() {
      const today = C.mskDay(new Date()), who = id => data.people.find(p => p.id === id);
      data.fstreaks.forEach(s => { if (s.status !== 'ended' && !C.fstreakAlive(s, today)) s.status = 'ended'; });
      const live = data.fstreaks.filter(s => s.status !== 'ended');
      return { friends: data.people.filter(p => relation(p.id) === 'friend'), requests: data.people.filter(p => relation(p.id) === 'follower'), sent: data.people.filter(p => relation(p.id) === 'following'),
        streaks: live.map(s => ({ id: s.id, status: s.status, days: s.days, invitedByMe: !!s.invitedByMe, friend: who(s.friend), meToday: s.a_day === today, friendToday: s.b_day === today,
          reward: C.fstreakReward(s, 'a'), next: C.fstreakNext(s.days) })), refLink: view().refLink, refRewards: data.player.refRewards || 0, player: view() };
    }
    data.snippets = data.snippets || [];
    const ok = x => Promise.resolve(x);
    return {
      demo: true,
      state: () => ok({ player: view(), promo: { left: data.player.promoUsed ? 0 : 73, available: !data.player.promoUsed } }),
      start(lessonId, restart) {
        const i = lessonIndex(lessonId);
        if (i < 0) return ok({ error: 'no_lesson' });
        const LESSONS = courseOf(lessonId).LESSONS;
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
        else if (s.i >= lesson.questions.length) {
          finished = C.finishLesson(data.player, lesson, s, now); data.session = null;
          data.fstreaks.forEach(x => C.fstreakMark(x, 'a', C.mskDay(now))); // забеги: моя часть на сегодня
        }
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
      questClaim(id) {
        const got = C.claimQuest(data.player, new Date(), id);
        if (!got) return ok({ error: 'not_ready', player: view() });
        save();
        return ok({ chest: got, player: view() });
      },
      admin() {
        const t = Date.now(), iso = m => new Date(t - m * 60000).toISOString();
        const players = data.people.map((p, i) => ({ ...p, source: ['tiktok', 'direct', 'friend', 'youtube'][i % 4], created: iso(60 * 24 * (i + 1)), seen: iso([2, 30, 300, 3000][i % 4]) }));
        return ok({ total: players.length, online: 1, activeToday: 3, newToday: 1, players });
      },
      // ---------- Друзья в демо: подписки, взаимная подписка = друзья, дружеские забеги ----------
      friends: () => ok(demoFriends()),
      friendSearch(q) {
        const t = String(q || '').trim().toLowerCase().replace(/^@/, '');
        const list = data.people.filter(p => p.name.toLowerCase().includes(t) || p.username === t);
        return ok({ list: list.map(p => ({ ...p, relation: relation(p.id) })) });
      },
      follow(id) {
        if (!data.people.some(p => p.id === id)) return ok({ error: 'not_found' });
        if (!data.following.includes(id)) data.following.push(id);
        save();
        return ok({ ok: true, friend: data.followers.includes(id), ...demoFriends() });
      },
      unfollow(id) {
        data.following = data.following.filter(x => x !== id);
        data.fstreaks.forEach(s => { if (s.friend === id) s.status = 'ended'; });
        save();
        return ok({ ok: true, ...demoFriends() });
      },
      streakInvite(id) {
        const F = demoFriends();
        if (!F.friends.some(f => f.id === id)) return ok({ error: 'not_friend' });
        if (F.streaks.some(s => s.friend.id === id)) return ok({ error: 'already' });
        if (F.streaks.length >= C.FSTREAK_MAX) return ok({ error: 'max' });
        // в демо друг сразу принимает и уже прошёл урок сегодня
        data.fstreaks.push({ id: Date.now(), friend: id, status: 'active', days: 0, start_day: C.mskDay(new Date()), last_day: null, a_day: null, b_day: C.mskDay(new Date()), a_reward: 0, b_reward: 0, invitedByMe: true });
        save();
        return ok({ ok: true, ...demoFriends() });
      },
      streakAccept(id) {
        const s = data.fstreaks.find(x => x.id === id);
        if (!s || s.status !== 'pending') return ok({ error: 'not_found', ...demoFriends() });
        s.status = 'active'; s.start_day = C.mskDay(new Date()); s.b_day = s.start_day; save();
        return ok({ ok: true, ...demoFriends() });
      },
      streakDecline(id) { return this.streakEnd(id); },
      streakEnd(id) {
        const s = data.fstreaks.find(x => x.id === id);
        if (s) s.status = 'ended';
        save();
        return ok({ ok: true, ...demoFriends() });
      },
      streakClaim(id) {
        const s = data.fstreaks.find(x => x.id === id);
        const goal = s && C.fstreakReward(s, 'a');
        if (!goal) return ok({ error: 'claimed', ...demoFriends() });
        s.a_reward = goal.n;
        const got = C.rollChest(goal.chest);
        data.player.gems = (data.player.gems || 0) + got.gems;
        C.applyBoost(data.player, got.boost, new Date());
        save();
        return ok({ chest: { ...got, n: goal.n }, player: view(), ...demoFriends() });
      },
      setLang(lang) { data.player.lang = C.cleanLang(lang); save(); return ok({ player: view() }); },
      snippetSave(code, lang) {
        if (!String(code || '').trim()) return ok({ error: 'empty' });
        const id = C.makeCode(Math.random, 8);
        data.snippets.unshift({ id, code, lang: C.cleanLang(lang), at: new Date().toISOString() }); save();
        return ok({ id, link: 'https://t.me/pythonshkabot?start=code_' + id });
      },
      snippets: () => ok({ list: data.snippets.slice(0, 20).map(s => ({ id: s.id, preview: s.code.split('\n')[0].slice(0, 60), lang: s.lang || 'python', at: s.at, link: 'https://t.me/pythonshkabot?start=code_' + s.id })) }),
      snippetGet(id) {
        const s = data.snippets.find(x => x.id === C.cleanCode(id));
        return ok(s ? { id: s.id, code: s.code, lang: s.lang || 'python', author: view().name, mine: true } : { error: 'not_found' });
      },
      profile(name, avatar) {
        const c = C.cleanName(name);
        if (!c.ok) return ok({ error: 'bad_name', message: c.error });
        data.player.profile = { name: c.name, avatar: C.cleanAvatar(avatar) };
        save();
        return ok({ player: view() });
      },
      reset() { data = { player: C.newPlayer(), session: null, snippets: [] }; save(); },
    };
  }

  root.API = cfg.API_URL ? remote(cfg.API_URL.replace(/\/$/, '')) : local();
})(typeof self !== 'undefined' ? self : this);
