#!/usr/bin/env python3
"""Проставляет версию в ссылки на css/js во всех страницах.

Браузер кеширует style.css и main.js по имени файла, и после правок можно
неделю смотреть на старую вёрстку, ничего не понимая. Версия в ссылке
(?v=<хеш>) делает адрес новым, и файл гарантированно скачивается заново.

Хеш считается по содержимому, так что версия меняется только когда файл
реально изменился. Запускать после правок css/js:

    python3 tools/stamp_assets.py

Если деплой застрял и сайт отдаёт старые страницы того же размера:

    python3 tools/stamp_assets.py --force

— размер каждой страницы изменится, и деплой её зальёт.
"""
import hashlib
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def short_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


MARK_RE = re.compile(r"[ \t]*<!-- сборка [0-9a-f]+(?: ~+)? -->\n?")


def committed_size(page):
    """Размер страницы в последнем коммите — после push это то, что на сервере."""
    try:
        rel = os.path.relpath(page, ROOT)
        out = subprocess.run(["git", "-C", ROOT, "show", "HEAD:" + rel],
                             capture_output=True, check=True)
        return len(out.stdout)
    except Exception:
        return None


def with_marker(core, digest, pad):
    marker = "<!-- сборка %s %s -->" % (digest, "~" * pad)
    if "</body>" in core:
        return core.replace("</body>", marker + "\n</body>", 1)
    return core.rstrip() + "\n" + marker + "\n"


def main():
    force = "--force" in sys.argv[1:]
    versions = {}
    for rel in ("css/style.css", "js/main.js", "js/catalog.js", "js/order.js",
                "panel/admin.css", "panel/admin.js"):
        full = os.path.join(ROOT, rel)
        if os.path.exists(full):
            versions[rel] = short_hash(full)

    # Ссылка может быть относительной (css/style.css), от корня (/css/style.css)
    # или на уровень выше (../css/style.css) — 404-я страница использует второй
    # вид, и без него её стили оставались со старой версией.
    pattern = re.compile(r'(href|src)="((?:/|\.\./)?(?:css|js|panel)/[\w.-]+\.(?:css|js))(?:\?v=[^"]*)?"')
    changed = 0
    pages = glob.glob(os.path.join(ROOT, "*.html")) + glob.glob(os.path.join(ROOT, "panel", "*.html"))
    for page in pages:
        text = open(page, encoding="utf-8").read()

        def stamp(m):
            attr, ref = m.group(1), m.group(2)
            key = ref.lstrip("./").lstrip("/")
            # ссылки внутри админки указывают на admin.css / admin.js без папки
            if key not in versions and os.path.basename(page).startswith("index") and "panel" in page:
                key = "panel/" + key
            version = versions.get(key)
            return '%s="%s?v=%s"' % (attr, ref, version) if version else m.group(0)

        updated = pattern.sub(stamp, text)
        # в админке ссылки идут без папки: admin.css, admin.js
        if "panel" in page:
            for name in ("admin.css", "admin.js"):
                version = versions.get("panel/" + name)
                if version:
                    updated = re.sub(r'(href|src)="%s(?:\?v=[^"]*)?"' % re.escape(name),
                                     lambda m, v=version, n=name: '%s="%s?v=%s"' % (m.group(1), n, v),
                                     updated)
        # Отметка сборки внизу страницы. По ней видно, какая версия реально
        # лежит на сайте, но главное — она меняет РАЗМЕР файла.
        #
        # Деплой сравнивает файлы по размеру. Когда в странице меняется только
        # версия скрипта (?v= — всегда 8 знаков), размер остаётся прежним, и
        # страница не заливается: сайт продолжает ссылаться на старый скрипт.
        # Хеш в отметке тоже фиксированной длины и сам по себе не помогает —
        # поэтому после него идёт заполнитель «~» переменной длины. Длину
        # подбираем так, чтобы размер отличался и от текущего файла, и от
        # последнего коммита (он и лежит на сервере после push).
        core = MARK_RE.sub("", updated)
        if core == MARK_RE.sub("", text) and not force:
            continue  # содержимое не менялось — файл не трогаем вовсе
        digest = hashlib.sha1(core.encode("utf-8")).hexdigest()[:12]
        avoid = {len(text.encode("utf-8")), committed_size(page)}
        start = int(digest, 16) % 16
        for step in range(16):
            pad = (start + step) % 16 + 1
            updated = with_marker(core, digest, pad)
            if len(updated.encode("utf-8")) not in avoid:
                break

        if updated != text:
            open(page, "w", encoding="utf-8").write(updated)
            changed += 1
            print("проштампована", os.path.relpath(page, ROOT))
    print("версии:", versions)
    print("страниц обновлено:", changed)


if __name__ == "__main__":
    sys.exit(main())
