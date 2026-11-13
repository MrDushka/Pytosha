// Единый запуск кода ученика для всех языков Питоши.
//   RUN.run(lang, code, tests, timeoutMs, opts) → { results } | { error }
//   python → Pyodide (py.js); js, lua → lang-worker.js; html → проверка разметки в скрытой рамке.
(function (root) {
  let worker = null, seq = 0, warmLua = false;
  const pending = new Map();
  function spawn() {
    worker = new Worker('lang-worker.js');
    worker.onmessage = e => {
      const p = pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer); pending.delete(e.data.id);
      if (p.lang === 'lua') warmLua = true;
      p.resolve(e.data);
    };
  }
  function runWorker(lang, code, tests, timeoutMs) {
    if (!worker) spawn();
    const id = ++seq;
    const limit = timeoutMs || (lang === 'lua' && !warmLua ? 40000 : 6000);
    return new Promise(resolve => {
      const timer = setTimeout(() => { pending.delete(id); worker.terminate(); worker = null; resolve({ error: 'timeout' }); }, limit);
      pending.set(id, { resolve, timer, lang });
      worker.postMessage({ id, lang, code, tests });
    });
  }

  // ---------- HTML и CSS: тесты смотрят на готовую страницу ----------
  // { query: 'h1' }                      — элемент есть
  // { query: 'li', count: 3 }            — элементов ровно столько
  // { query: 'h1', text: 'Привет' }      — текст элемента
  // { query: 'a', attr: 'href', value }  — атрибут
  // { query: 'h1', css: 'color', value: 'rgb(255, 0, 0)' } — итоговый стиль
  function runHtml(code, tests) {
    return new Promise(resolve => {
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-same-origin'); // без скриптов ученика — только разметка и стили
      f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:600px;visibility:hidden';
      document.body.appendChild(f);
      const done = () => {
        const doc = f.contentDocument, win = f.contentWindow;
        const results = (tests || []).map(t => {
          if (t.run) return { ok: true, err: null, printed: '' };
          const els = doc ? [...doc.querySelectorAll(t.query)] : [];
          let ok = false, got = '';
          if ('count' in t) { got = String(els.length); ok = els.length === t.count; }
          else if (!els.length) got = 'нет элемента ' + t.query;
          else if ('text' in t) { got = els[0].textContent.trim(); ok = got === t.text; }
          else if ('attr' in t) { got = els[0].getAttribute(t.attr) || ''; ok = got === t.value; }
          else if ('css' in t) { got = win.getComputedStyle(els[0]).getPropertyValue(t.css).trim(); ok = got === t.value; }
          else ok = true;
          return { ok, err: null, printed: got, expected: t.text || t.value || (('count' in t) ? String(t.count) : t.query), check: t.hint || '' };
        });
        f.remove();
        resolve({ results });
      };
      f.onload = done;
      f.srcdoc = code;
      setTimeout(() => { if (f.isConnected) done(); }, 3000);
    });
  }

  function run(lang, code, tests, timeoutMs, opts) {
    if (lang === 'python' || !lang) return root.PY.run(code, tests, timeoutMs, opts);
    if (lang === 'html') return runHtml(code, tests);
    return runWorker(lang, code, tests, timeoutMs);
  }
  const isWarm = lang => (lang === 'python' || !lang ? root.PY.isWarm() : lang === 'lua' ? warmLua : true);
  const preload = lang => { if (lang === 'python' || !lang) root.PY.preload(); else if (lang === 'lua' && !warmLua) runWorker('lua', '', [{ run: true }], 60000); };

  root.RUN = { run, isWarm, preload };
})(typeof self !== 'undefined' ? self : this);
