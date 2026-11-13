// Запуск JavaScript и Lua учеников в фоновом потоке (зависший цикл не повесит приложение — поток убивают).
// Сообщение: { id, lang: 'js' | 'lua', code, tests } → { id, results } в том же виде, что у Python (py-harness).
//   тест { stdin, out } — подать ввод, сравнить напечатанное; { stdin, run: true } — просто запустить.
const LUA_URL = 'https://cdn.jsdelivr.net/npm/fengari-web@0.1.4/dist/fengari-web.js';
let luaReady = null;
self.window = self; // fengari-web ждёт window

function clean(s) { return String(s).replace(/\r\n/g, '\n').replace(/\s+$/, '').split('\n').map(l => l.replace(/\s+$/, '')).join('\n'); }
const fmt = v => (typeof v === 'string' ? v : v === undefined ? 'undefined' : (() => { try { return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v); } catch (e) { return String(v); } })());

// ---------- JavaScript ----------
function runJs(code, stdin) {
  const out = [];
  const lines = stdin ? String(stdin).split('\n') : [];
  const read = () => { if (!lines.length) throw new Error('prompt() ждёт ещё данные, а их больше нет'); return lines.shift(); };
  const con = { log: (...a) => out.push(a.map(fmt).join(' ')), error: (...a) => out.push(a.map(fmt).join(' ')), warn: (...a) => out.push(a.map(fmt).join(' ')), info: (...a) => out.push(a.map(fmt).join(' ')) };
  let err = null;
  try {
    // prompt/input — читают строки из поля «Ввод»; alert — печатает
    new Function('console', 'prompt', 'input', 'alert', 'document', 'window', 'self', 'postMessage', 'importScripts', '"use strict";\n' + code)(
      con, () => read(), () => read(), m => out.push(fmt(m)), undefined, undefined, undefined, undefined, undefined);
  } catch (e) {
    const m = /<anonymous>:(\d+)/.exec(String(e.stack || ''));
    err = `${e.name || 'Error'}: ${e.message}` + (m ? ` (строка ${Number(m[1]) - 3})` : '');
  }
  return { printed: clean(out.join('\n')), err };
}

// ---------- Lua (Roblox учит Luau — основа та же, что у Lua) ----------
async function luaBoot() {
  const text = await (await fetch(LUA_URL)).text();
  (0, eval)(text);
  return self.fengari;
}
function runLua(F, code, stdin) {
  const { lua, lauxlib, lualib, to_luastring, to_jsstring } = F;
  const out = [];
  const lines = stdin ? String(stdin).split('\n') : [];
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  const fn = (name, f) => { lua.lua_pushjsfunction(L, f); lua.lua_setglobal(L, to_luastring(name)); };
  fn('print', L2 => {
    const n = lua.lua_gettop(L2), parts = [];
    for (let i = 1; i <= n; i++) { parts.push(to_jsstring(lauxlib.luaL_tolstring(L2, i))); lua.lua_pop(L2, 1); }
    out.push(parts.join('\t')); return 0;
  });
  // ввод: io.read() и input() берут строки из поля «Ввод»
  const read = L2 => { if (!lines.length) return lauxlib.luaL_error(L2, to_luastring('io.read() ждёт ещё данные, а их больше нет')); lua.lua_pushstring(L2, to_luastring(lines.shift())); return 1; };
  fn('input', read);
  lauxlib.luaL_dostring(L, to_luastring('io = io or {}; io.read = input; io.write = function(...) local t = {} for i, v in ipairs({...}) do t[#t + 1] = tostring(v) end print(table.concat(t)) end; wait = function() end; task = { wait = function() end }'));
  let st = lauxlib.luaL_loadstring(L, to_luastring(code));
  if (st === 0) st = lua.lua_pcall(L, 0, 0, 0);
  let err = null;
  if (st) err = to_jsstring(lua.lua_tostring(L, -1)).replace(/^\[string ".*?"\]:(\d+):/, (m, n) => `Ошибка (строка ${n}):`);
  return { printed: clean(out.join('\n')), err };
}

self.onmessage = async e => {
  const { id, lang, code, tests } = e.data;
  try {
    let F = null;
    if (lang === 'lua') { if (!luaReady) luaReady = luaBoot(); F = await luaReady; }
    const results = tests.map(t => {
      const r = lang === 'lua' ? runLua(F, code, t.stdin) : runJs(code, t.stdin);
      const ok = t.run ? !r.err : !r.err && r.printed === clean(t.out || '');
      return { ok, err: r.err, printed: r.printed.slice(0, t.run ? 20000 : 2000), stdin: t.stdin || '', expected: t.out };
    });
    self.postMessage({ id, results });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
