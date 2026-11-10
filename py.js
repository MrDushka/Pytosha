// Запуск Python ученика: фоновый поток + ограничение по времени (бесконечный цикл не повесит приложение).
(function (root) {
  let worker = null, seq = 0;
  const pending = new Map();
  let warm = false;

  function spawn() {
    worker = new Worker('py-worker.js');
    worker.onmessage = e => {
      const p = pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(e.data.id);
      warm = true;
      p.resolve(e.data);
    };
  }

  // tests — см. py-harness.py. timeoutMs — сколько ждать (первый запуск дольше: Python скачивается).
  function run(code, tests, timeoutMs) {
    if (!worker) spawn();
    const id = ++seq;
    const limit = timeoutMs || (warm ? 6000 : 60000);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        pending.delete(id);
        worker.terminate(); worker = null; warm = false; // убиваем зависший Python и начнём заново
        resolve({ error: warm ? 'timeout' : 'timeout' });
      }, limit);
      pending.set(id, { resolve, timer });
      worker.postMessage({ id, code, tests });
    });
  }

  // Заранее скачать Python, пока ученик читает задачу
  function preload() { if (!warm && !worker) run('', [{ run: true }], 90000); }

  root.PY = { run, preload, isWarm: () => warm };
})(typeof self !== 'undefined' ? self : this);
