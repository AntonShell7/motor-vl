#!/usr/bin/env python3
"""Проставляет версию в ссылки на css/js во всех страницах.

Браузер кеширует style.css и main.js по имени файла, и после правок можно
неделю смотреть на старую вёрстку, ничего не понимая. Версия в ссылке
(?v=<хеш>) делает адрес новым, и файл гарантированно скачивается заново.

Хеш считается по содержимому, так что версия меняется только когда файл
реально изменился. Запускать после правок css/js:

    python3 tools/stamp_assets.py
"""
import hashlib
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def short_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def main():
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
        # Отметка сборки внизу страницы. Нужна не для красоты: по ней видно,
        # какая версия реально лежит на сайте, и размер файла меняется вместе
        # с содержимым — иначе зеркалирование по размеру считает страницу
        # неизменной и правки вёрстки не доезжают.
        updated = re.sub(r"[ \t]*<!-- сборка [0-9a-f]+ -->\n?", "", updated)
        marker = "<!-- сборка %s -->" % hashlib.sha1(updated.encode("utf-8")).hexdigest()[:12]
        if "</body>" in updated:
            updated = updated.replace("</body>", marker + "\n</body>", 1)
        else:
            updated = updated.rstrip() + "\n" + marker + "\n"

        if updated != text:
            open(page, "w", encoding="utf-8").write(updated)
            changed += 1
            print("проштампована", os.path.relpath(page, ROOT))
    print("версии:", versions)
    print("страниц обновлено:", changed)


if __name__ == "__main__":
    sys.exit(main())
