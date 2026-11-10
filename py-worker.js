// Python в фоновом потоке: Pyodide (настоящий Python, скомпилированный для браузера).
// В отдельном потоке — чтобы бесконечный цикл ученика не «повесил» приложение: его можно просто убить.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let ready = null;
async function boot() {
  const py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
  const harness = await (await fetch('py-harness.py')).text();
  py.runPython(harness);
  return py;
}

self.onmessage = async e => {
  const { id, code, tests } = e.data;
  try {
    if (!ready) ready = boot();
    const py = await ready;
    py.globals.set('__code', code);
    py.globals.set('__tests', JSON.stringify(tests));
    const res = py.runPython('json.dumps(run_tests(__code, json.loads(__tests)), ensure_ascii=False)');
    self.postMessage({ id, results: JSON.parse(res) });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
