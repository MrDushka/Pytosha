# Проверялка решений Питоши. Одна и та же — в браузере (Pyodide) и при проверке курса на компьютере.
# run_tests(code, tests) -> список результатов.
# Тест — словарь:
#   {"stdin": "5\n3", "out": "8"}        — подать ввод, сравнить напечатанное
#   {"expr": "square(5)", "expect": "25"} — после кода вычислить выражение, сравнить repr()
#   {"stdin": "...", "run": True}        — просто запустить и показать вывод (кнопка «Запустить»)
import sys, io, json, builtins


def _clean(s):
    return "\n".join(line.rstrip() for line in s.replace("\r\n", "\n").rstrip().split("\n"))


def run_tests(code, tests):
    results = []
    for t in tests:
        lines = t.get("stdin", "").split("\n") if t.get("stdin") else []
        feed = iter(lines)

        def fake_input(prompt=""):
            try:
                return next(feed)
            except StopIteration:
                raise EOFError("input() ждёт ещё данные, а их больше нет")

        out = io.StringIO()
        g = {"__name__": "__main__", "__builtins__": builtins, "input": fake_input}
        old = sys.stdout
        sys.stdout = out
        err = None
        got = None
        try:
            exec(compile(code, "<твой код>", "exec"), g)
            if "expr" in t:
                got = repr(eval(t["expr"], g))
        except SystemExit:
            pass
        except BaseException as e:  # noqa: BLE001 — показываем ученику любую ошибку
            line = ""
            tb = e.__traceback__
            while tb is not None:
                if tb.tb_frame.f_code.co_filename == "<твой код>":
                    line = f" (строка {tb.tb_lineno})"
                tb = tb.tb_next
            if isinstance(e, SyntaxError):
                err = f"{type(e).__name__}: {e.msg}" + (f" (строка {e.lineno})" if e.lineno else "")
            else:
                err = f"{type(e).__name__}: {e}{line}"
        finally:
            sys.stdout = old
        printed = _clean(out.getvalue())
        if t.get("run"):
            ok = err is None
        elif "expr" in t:
            ok = err is None and got == t["expect"]
        else:
            ok = err is None and printed == _clean(t["out"])
        results.append({
            "ok": ok,
            "err": err,
            "printed": printed[:2000],
            "got": got,
            "stdin": t.get("stdin", ""),
            "expr": t.get("expr"),
            "expected": t.get("expect") if "expr" in t else t.get("out"),
        })
    return results


if __name__ == "__main__" and sys.platform != "emscripten":  # в браузере (Pyodide) этот блок не нужен
    # Для проверки курса: python py-harness.py < {"code": ..., "tests": [...]}
    data = json.load(sys.stdin)
    print(json.dumps(run_tests(data["code"], data["tests"]), ensure_ascii=False))
