// ===== МОТОР-ВЛ: логика страницы каталога =====
// Данные каталога подгружаются из data/motors.json и data/brands.json —
// это позволяет обновлять каталог через админ-панель (/admin) без правки кода.

document.addEventListener("DOMContentLoaded", function () {
  var grid = document.getElementById("motorGrid");
  var tabsWrap = document.getElementById("brandTabs");
  var resultsCount = document.getElementById("resultsCount");
  var hpFilterWrap = document.getElementById("hpFilter");
  if (!grid || !tabsWrap) return;

  var MOTORS = [];
  var BRANDS = [];
  var currentBrand = "";

  // Фиксированные диапазоны мощности для кнопок быстрого перехода по списку.
  // Показываются только те диапазоны, для которых в текущем бренде реально есть моторы.
  var HP_RANGES = [
    { min: 0, max: 25, label: "0–25 л.с." },
    { min: 30, max: 60, label: "30–60 л.с." },
    { min: 70, max: Infinity, label: "70+ л.с." }
  ];

  // В карточке подписи должны быть короткими, иначе они занимают всю строку
  // и значение уезжает вниз. В данных и в админке названия остаются полными.
  // Значения из каталога местами описательные и в строку не помещаются.
  // Для показа в карточке сокращаем их до сути; в данных и в панели
  // остаётся исходный текст, он же виден в подсказке при наведении.
  var SPEC_SHORT_VALUES = {
    "продаётся с машинкой": "машинка управления",
    "продаётся с пультом управления": "пульт управления",
    "продаётся с пультом управления (можно установить мультирумпель)": "пульт управления",
    "мультирумпель, топливный бак, шланг в комплекте": "мультирумпель, бак, шланг",
    "ручная (гидродемпфер)": "ручной, гидродемпфер",
    "ручная (демпфер)": "ручной, демпфер",
    "ручной (гидродемпфер)": "ручной, гидродемпфер",
    "ручной (демпфер)": "ручной, демпфер"
  };

  var SPEC_SHORT_LABELS = {
    "Возможность увеличения мощности": "Увеличение мощности",
    "Система подачи топлива": "Подача топлива"
  };

  function formatPrice(n) {
    return n.toLocaleString("ru-RU") + " ₽";
  }

  // Извлекает мощность мотора (л.с.) из его названия по номеру модели —
  // у моторов её отдельно не хранится, но она всегда зашита в модель (F25, BF75, DF30, Tohatsu 15...).
  function extractHP(motor) {
    var t = motor.title;
    var m = null;
    if (motor.brand === "yamaha") m = t.match(/F\s?(\d{1,3})/i);
    else if (motor.brand === "honda") m = t.match(/BF\s?(\d{1,3})/i);
    else if (motor.brand === "suzuki") m = t.match(/DF\s?(\d{1,3})/i);
    else if (motor.brand === "tohatsu") m = t.match(/(\d{1,3})/);
    return m ? parseInt(m[1], 10) : null;
  }

  // Определяет, в какой диапазон мощности попадает мотор — используется, чтобы
  // разделить список визуальным промежутком на границах диапазонов.
  function bucketOf(hp) {
    if (hp === null) return null;
    for (var i = 0; i < HP_RANGES.length; i++) {
      if (hp >= HP_RANGES[i].min && hp <= HP_RANGES[i].max) return i;
    }
    return null;
  }

  function sortedList() {
    var list = MOTORS.filter(function (m) {
      return m.brand === currentBrand;
    });
    // От маленьких моторов к большим — сначала минимальная мощность, в конце максимальная.
    list.sort(function (a, b) {
      var ah = extractHP(a); var bh = extractHP(b);
      return (ah === null ? Infinity : ah) - (bh === null ? Infinity : bh);
    });
    return list;
  }

  function renderTabs() {
    tabsWrap.innerHTML = BRANDS.map(function (b) {
      var count = MOTORS.filter(function (m) { return m.brand === b.key; }).length;
      return '<button class="brand-tab' + (b.key === currentBrand ? " active" : "") + '" data-brand="' + b.key + '">' +
        b.label + '<span class="count">(' + count + ')</span></button>';
    }).join("");

    tabsWrap.querySelectorAll(".brand-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentBrand = btn.getAttribute("data-brand");
        renderTabs();
        renderHpFilter();
        renderGrid();
      });
    });
  }

  function renderHpFilter() {
    if (!hpFilterWrap) return;

    // У запчастей нет единой мощности мотора — фильтр там не нужен.
    if (currentBrand === "parts") {
      hpFilterWrap.innerHTML = "";
      hpFilterWrap.style.display = "none";
      return;
    }

    var brandMotors = MOTORS.filter(function (m) { return m.brand === currentBrand; });
    var available = HP_RANGES.filter(function (r) {
      return brandMotors.some(function (m) {
        var hp = extractHP(m);
        return hp !== null && hp >= r.min && hp <= r.max;
      });
    });

    if (!available.length) {
      hpFilterWrap.innerHTML = "";
      hpFilterWrap.style.display = "none";
      return;
    }

    hpFilterWrap.style.display = "";
    hpFilterWrap.innerHTML = '<span class="hp-filter__label">Мощность:</span>' +
      available.map(function (r) {
        return '<button type="button" class="hp-filter__btn" data-min="' + r.min + '" data-max="' + r.max + '">' + r.label + '</button>';
      }).join("");

    hpFilterWrap.querySelectorAll(".hp-filter__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var min = parseFloat(btn.getAttribute("data-min"));
        var max = parseFloat(btn.getAttribute("data-max"));
        jumpToHpRange(min, max);
      });
    });
  }

  function jumpToHpRange(min, max) {
    var list = sortedList();
    var cards = grid.querySelectorAll(".motor-card");
    var targetCard = null;

    for (var i = 0; i < list.length; i++) {
      var hp = extractHP(list[i]);
      if (hp !== null && hp >= min && hp <= max) {
        targetCard = cards[i];
        break;
      }
    }
    if (!targetCard) return;

    // Если перед первым мотором этого диапазона есть разделительная линия — переходим
    // именно на неё (block:"start"), чтобы она оказалась вверху экрана, а моторы диапазона —
    // сразу под ней. Если диапазон самый первый в списке (разделителя перед ним нет,
    // он и так в самом верху) — переходим на первую карточку.
    var bucketIndex = HP_RANGES.findIndex(function (r) { return r.min === min && r.max === max; });
    var divider = grid.querySelector('.motor-grid__divider[data-bucket="' + bucketIndex + '"]');
    var scrollTarget = divider || targetCard;
    scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });

    targetCard.classList.add("motor-card--flash");
    setTimeout(function () { targetCard.classList.remove("motor-card--flash"); }, 1200);
  }

  function renderGrid() {
    var list = sortedList();

    if (resultsCount) {
      resultsCount.textContent = "Найдено позиций: " + list.length;
    }

    var prevBucket = undefined;

    grid.innerHTML = list.map(function (m, i) {
      var hp = extractHP(m);
      var bucket = bucketOf(hp);
      var dividerHtml = "";
      if (bucket !== null && bucket !== prevBucket && prevBucket !== undefined) {
        dividerHtml = '<div class="motor-grid__divider" data-bucket="' + bucket + '"><span>' + HP_RANGES[bucket].label + '</span></div>';
      }
      prevBucket = bucket;

      // Характеристики — строго в столбик, по одному пункту на строку:
      // подпись слева, значение справа. Значение всегда в одну строку —
      // если не влезает, обрезаем многоточием, а полный текст остаётся
      // в подсказке при наведении. Незаполненные пункты не показываем.
      var filled = m.specs.filter(function (s) { return s[1]; });
      var specsHtml = filled.map(function (s) {
        var label = SPEC_SHORT_LABELS[s[0]] || s[0];
        var value = SPEC_SHORT_VALUES[s[1]] || s[1];
        return '<div class="spec-row">' +
                 "<em>" + label + "</em>" +
                 '<b title="' + s[1].replace(/"/g, "&quot;") + '">' + value + "</b>" +
               "</div>";
      }).join("");

      // Плашек три, цвет закреплён за надписью. У старых карточек цвет
      // не сохранён — определяем его по тексту, чтобы каталог выглядел ровно.
      var BADGE_TONES = { "Новый": "gold", "Хит продаж": "green", "Распродажа": "red" };
      var badgeTone = m.badgeColor || BADGE_TONES[m.badge] || "";
      var badgeHtml = m.badge
        ? '<span class="motor-card__badge' + (badgeTone ? " motor-card__badge--" + badgeTone : "") + '">' + m.badge + "</span>"
        : "";

      var photos = (m.photos && m.photos.length) ? m.photos : [m.img];
      var videos = m.videos || [];

      var metaChips = "";
      if (photos.length > 1) metaChips += '<span class="motor-card__meta-chip">📷 ' + photos.length + "</span>";
      if (videos.length) metaChips += '<span class="motor-card__meta-chip">🎬 ' + videos.length + "</span>";
      var metaHtml = metaChips ? '<div class="motor-card__meta">' + metaChips + "</div>" : "";

      return (
        dividerHtml +
        '<div class="motor-card reveal in">' +
          '<div class="motor-card__media">' +
            badgeHtml +
            metaHtml +
            '<img src="' + m.img + '" alt="' + m.title + '" loading="lazy" ' +
              'data-lightbox="' + m.img + '" data-caption="' + m.title + '" ' +
              'data-motor-id="' + String(m.id || "").replace(/"/g, "&quot;") + '" ' +
              "data-photos='" + JSON.stringify(photos).replace(/'/g, "&#39;") + "' " +
              "data-videos='" + JSON.stringify(videos).replace(/'/g, "&#39;") + "' " +
              '>' +
          "</div>" +
          '<div class="motor-card__body">' +
            '<p class="motor-card__title">' + m.title + "</p>" +
            '<div class="motor-card__price">' + formatPrice(m.price) + "<span>Цена</span></div>" +
            (specsHtml ? '<div class="spec-list">' + specsHtml + "</div>" : "") +
            // Отдельный адрес мотора: менеджеру есть что отправить клиенту,
            // а поисковики видят каждую позицию отдельной страницей.
            '<a class="motor-card__link" href="/motor/' + encodeURIComponent(m.id || "") + '">Открыть страницу мотора →</a>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  // Дописывает каждому ролику обложку и длительность из data/video-meta.json.
  function applyVideoMeta(motors, meta) {
    var items = meta && meta.items;
    if (!items) return;
    motors.forEach(function (m) {
      (m.videos || []).forEach(function (v) {
        if (!v || typeof v !== "object" || !v.url) return;
        // Ролики, загруженные через панель, приносят обложку и длительность
        // с собой — их не перезаписываем. Файл video-meta.json нужен только
        // для роликов, перенесённых со старого сайта.
        if (v.poster) return;
        var info = items[v.url];
        if (!info) return;
        v.poster = info.poster || "";
        v.duration = v.duration || info.duration || null;
      });
    });
  }

  function startCatalog(motors, brands) {
    MOTORS = motors;
    BRANDS = brands;

    // Если пришли по ссылке с якорем бренда, например catalog.html#honda
    var hashBrand = location.hash.replace("#", "");
    if (BRANDS.some(function (b) { return b.key === hashBrand; })) {
      currentBrand = hashBrand;
    } else {
      currentBrand = BRANDS.length ? BRANDS[0].key : "";
    }

    renderTabs();
    renderHpFilter();
    renderGrid();
  }

  grid.innerHTML = '<p style="color:var(--text-muted);">Загружаем каталог…</p>';

  Promise.all([
    // no-cache — не «не кешировать», а «каждый раз спрашивать сервер, не
    // изменилось ли». Без этого браузер показывал старый каталог: мотор
    // добавлен в панели, а на сайте его ещё нет. Если файл не менялся,
    // сервер ответит «тот же» и ничего не скачается.
    fetch("data/motors.json", { cache: "no-cache" }).then(function (r) { return r.json(); }),
    fetch("data/brands.json", { cache: "no-cache" }).then(function (r) { return r.json(); }),
    // Обложки и длительность роликов лежат отдельно (их делает tools/make_posters.py).
    // Файла может не быть — тогда плитки видео просто останутся без картинки.
    fetch("data/video-meta.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (results) {
    applyVideoMeta(results[0], results[2]);
    startCatalog(results[0], results[1]);
  }).catch(function () {
    // Если страница открыта двойным кликом (файл file://, без веб-сервера), браузер блокирует
    // подгрузку data/*.json через fetch. В этом случае используем копию данных, встроенную
    // прямо в HTML-страницу (см. <script> перед подключением catalog.js) — так каталог
    // работает и при обычном открытии файла. На живом сайте (Netlify) эта заглушка не нужна:
    // fetch отрабатывает первым и подхватывает свежие данные, включая правки из /admin.
    if (window.__MOTORS_FALLBACK__ && window.__BRANDS_FALLBACK__) {
      startCatalog(window.__MOTORS_FALLBACK__, window.__BRANDS_FALLBACK__);
    } else {
      grid.innerHTML = '<p style="color:var(--jp-red);">Не удалось загрузить каталог. Попробуйте обновить страницу.</p>';
    }
  });
});
