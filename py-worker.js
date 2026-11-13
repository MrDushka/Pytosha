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

// Песочница: строки «pip install имя» (можно с ! или %) ставят библиотеки и убираются из кода
function extractPip(code) {
  const pips = [];
  const clean = code.split('\n').map(line => {
    const m = /^\s*[!%]?\s*pip3?\s+install\s+(.+?)\s*$/.exec(line);
    if (!m) return line;
    for (const name of m[1].split(/\s+/)) if (/^[A-Za-z0-9_.\-\[\]=<>~!]+$/.test(name) && !name.startsWith('-')) pips.push(name);
    return ''; // пустая строка — чтобы номера строк в ошибках не сдвинулись
  }).join('\n');
  return { clean, pips };
}

// Какие import в коде ещё не установлены
const FIND_MISSING = `
import ast, importlib.util
def __missing(code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []
    names = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            names |= {a.name.split('.')[0] for a in n.names}
        elif isinstance(n, ast.ImportFrom) and n.module and n.level == 0:
            names.add(n.module.split('.')[0])
    return sorted(x for x in names if importlib.util.find_spec(x) is None)
`;

// Библиотеки, которым нужен компьютер: окна, звук, клавиатура. В браузере их не бывает — не пытаемся ставить.
const DESKTOP_ONLY = {
  tkinter: 'окна и кнопки (tkinter)', _tkinter: 'окна и кнопки (tkinter)', turtle: 'черепашка-рисовалка (turtle)',
  pygame: 'игры с окном (pygame)', pyglet: 'игры с окном (pyglet)', arcade: 'игры с окном (arcade)', kivy: 'окна (kivy)',
  PyQt5: 'окна (PyQt)', PyQt6: 'окна (PyQt)', PySide6: 'окна (PySide)', wx: 'окна (wxPython)',
  winsound: 'звук Windows (winsound)', msvcrt: 'клавиатура Windows (msvcrt)', keyboard: 'клавиатура (keyboard)', mouse: 'мышь (mouse)',
  pyautogui: 'управление мышью (pyautogui)', curses: 'консольные окна (curses)', aiogram: 'Telegram-боты (aiogram)', telebot: 'Telegram-боты (telebot)',
};

async function installFor(py, code, pips) {
  const log = [];
  // 1) библиотеки, которые уже собраны для Pyodide (numpy, pandas, matplotlib…)
  try { await py.loadPackagesFromImports(code); } catch (e) { /* не нашлось — попробуем pip */ }
  py.runPython(FIND_MISSING);
  py.globals.set('__src', code);
  const missing = py.runPython('__missing(__src)').toJs();
  const desktop = [...new Set([...pips, ...missing])].filter(n => DESKTOP_ONLY[n]);
  self.__desktop = desktop.map(n => DESKTOP_ONLY[n]);
  const want = [...new Set([...pips, ...missing])].filter(n => !DESKTOP_ONLY[n]);
  if (!want.length) return log;
  // 2) остальное — с PyPI через micropip (подходят библиотеки на чистом Python)
  await py.loadPackage('micropip');
  const micropip = py.pyimport('micropip');
  for (const name of want) {
    try { await micropip.install(name); log.push(`📦 Установлено: ${name}`); }
    catch (e) { log.push(`⚠️ Библиотеку ${name} не получилось скачать: в телефоне работают библиотеки на чистом Python и популярные научные (numpy, pandas, matplotlib…)`); }
  }
  return log;
}

self.onmessage = async e => {
  const { id, code, tests, sandbox } = e.data;
  try {
    if (!ready) ready = boot();
    const py = await ready;
    let run = code, log = [];
    self.__desktop = [];
    if (sandbox) {
      const p = extractPip(code);
      run = p.clean;
      log = await installFor(py, run, p.pips);
    }
    py.globals.set('__code', run);
    py.globals.set('__tests', JSON.stringify(tests));
    const res = py.runPython('json.dumps(run_tests(__code, json.loads(__tests)), ensure_ascii=False)');
    self.postMessage({ id, results: JSON.parse(res), log, desktop: self.__desktop || [] });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
