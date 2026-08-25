// ===== МОТОР-ВЛ: логика админ-панели =====
// Общается с /api/motors.php и /api/lead.php на своём хостинге:
// каталог и заявки лежат файлами на сервере.

(function () {
  "use strict";

  var API_URL = "/api/motors.php";
  var LEADS_URL = "/api/lead.php";
  var SESSION_KEY = "motorvl_admin_password";

  var loginScreen = document.getElementById("loginScreen");
  var adminApp = document.getElementById("adminApp");
  var passwordInput = document.getElementById("passwordInput");
  var loginBtn = document.getElementById("loginBtn");
  var loginError = document.getElementById("loginError");
  var logoutBtn = document.getElementById("logoutBtn");

  var tabMotors = document.getElementById("tabMotors");
  var tabLeads = document.getElementById("tabLeads");
  var tabSold = document.getElementById("tabSold");
  var tabStats = document.getElementById("tabStats");
  var soldView = document.getElementById("soldView");
  var soldList = document.getElementById("soldList");
  var soldCount = document.getElementById("soldCount");
  var soldSummary = document.getElementById("soldSummary");
  var statsView = document.getElementById("statsView");
  var statsRange = document.getElementById("statsRange");
  var statsCards = document.getElementById("statsCards");
  var statsChart = document.getElementById("statsChart");
  var statsSources = document.getElementById("statsSources");
  var statsPages = document.getElementById("statsPages");
  var statsRegions = document.getElementById("statsRegions");
  var statsResetBtn = document.getElementById("statsReset");
  var statsLogBtn = document.getElementById("statsLogBtn");
  var statsLog = document.getElementById("statsLog");
  var currentSold = [];
  var leadsBadge = document.getElementById("leadsBadge");
  var leadsView = document.getElementById("leadsView");
  var leadsList = document.getElementById("leadsList");
  var leadsCount = document.getElementById("leadsCount");
  var leadsStatusMsg = document.getElementById("leadsStatusMsg");

  var listView = document.getElementById("listView");
  var formView = document.getElementById("formView");
  var motorList = document.getElementById("motorList");
  var motorCount = document.getElementById("motorCount");
  var statusMsg = document.getElementById("statusMsg");
  var newMotorBtn = document.getElementById("newMotorBtn");
  var brandFilterEl = document.getElementById("brandFilter");
  var motorSearchEl = document.getElementById("motorSearch");
  var backBtn = document.getElementById("backBtn");
  var formTitle = document.getElementById("formTitle");
  var motorForm = document.getElementById("motorForm");
  var deleteBtn = document.getElementById("deleteBtn");

  var fId = document.getElementById("fId");
  var fBrand = document.getElementById("fBrand");
  var fTitle = document.getElementById("fTitle");
  var fPrice = document.getElementById("fPrice");
  var fBadge = document.getElementById("fBadge");
  var badgeChoicesEl = document.getElementById("badgeChoices");

  // Плашка осталась одна — «Новый». «Хит продаж» и «Распродажа» забирали
  // внимание с фотографии и цены, ничего не сообщая о самом моторе.
  var BADGES = [
    { text: "", tone: "", label: "Без плашки", css: "transparent" },
    { text: "Новый", tone: "gold", css: "#d4af37" }
  ];
  var badgeColor = "";

  var photoDrop = document.getElementById("photoDrop");
  var photoInput = document.getElementById("photoInput");
  var photoListEl = document.getElementById("photoList");
  var videoListEl = document.getElementById("videoList");
  var specListEl = document.getElementById("specList");
  var videoDrop = document.getElementById("videoDrop");
  var videoInput = document.getElementById("videoInput");
  var addSpecBtn = document.getElementById("addSpecBtn");

  var currentMotors = [];
  // Бренды берём из того же перечня, что и выпадающий список в форме.
  var BRANDS = [
    { key: "yamaha", label: "Yamaha" },
    { key: "honda", label: "Honda" },
    { key: "suzuki", label: "Suzuki" },
    { key: "tohatsu", label: "Tohatsu / Mercury" },
    { key: "parts", label: "Запчасти" }
  ];
  // Выбранный бренд и строка поиска — чтобы в списке было видно только нужное.
  var searchQuery = "";
  var currentLeads = [];
  var photoState = [];   // [{type:'existing'|'new', url|dataBase64, filename, isMain}]
  var videoState = [];   // [{label, url, poster, duration}]
  var specState = [];    // [[key, value]]

  function password() {
    return sessionStorage.getItem(SESSION_KEY) || "";
  }

  function formatPrice(n) {
    return Number(n || 0).toLocaleString("ru-RU") + " ₽";
  }

  // Старые фото — полные внешние ссылки (https://...), новые — относительные
  // пути внутри сайта (media/motors/...). Админка лежит в подпапке /admin,
  // поэтому относительным путям нужно "../" впереди, а внешним — нет.
  function resolveUrl(url) {
    if (!url) return "";
    return /^https?:\/\//.test(url) ? url : "../" + url;
  }

  // ---------- Вход ----------
  function tryLogin(pass) {
    loginError.textContent = "";
    return fetch(API_URL, { headers: { "x-admin-password": pass } })
      .then(function (res) {
        if (res.status === 401) throw new Error("Неверный пароль");
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || "Ошибка сервера"); });
        return res.json();
      })
      .then(function (data) {
        sessionStorage.setItem(SESSION_KEY, pass);
        currentMotors = data.motors || [];
        showApp();
      })
      .catch(function (err) {
        loginError.textContent = err.message;
      });
  }

  loginBtn.addEventListener("click", function () {
    var pass = passwordInput.value;
    if (!pass) return;
    loginBtn.disabled = true;
    tryLogin(pass).then(function () { loginBtn.disabled = false; });
  });
  passwordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") loginBtn.click();
  });

  logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  function showApp() {
    loginScreen.style.display = "none";
    adminApp.style.display = "block";
    renderList();
    loadLeads();
  }

  // Автовход, если пароль уже сохранён в этой вкладке браузера
  if (password()) {
    tryLogin(password());
  }

  // ---------- Переключение вкладок ----------
  // Одна функция на все вкладки: раньше каждая гасила соседей вручную,
  // и с добавлением новых это быстро превратилось бы в кашу.
  function showTab(name) {
    var tabs = { motors: tabMotors, leads: tabLeads, sold: tabSold, stats: tabStats };
    var views = { leads: leadsView, sold: soldView, stats: statsView };
    Object.keys(tabs).forEach(function (key) {
      if (tabs[key]) tabs[key].classList.toggle("active", key === name);
    });
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].style.display = key === name ? "block" : "none";
    });
    if (name !== "motors") {
      listView.style.display = "none";
      formView.style.display = "none";
    }
  }

  tabMotors.addEventListener("click", function () {
    showTab("motors");
    renderList();
  });
  tabLeads.addEventListener("click", function () {
    showTab("leads");
    renderLeads();
  });
  if (tabSold) {
    tabSold.addEventListener("click", function () {
      showTab("sold");
      loadSold();
    });
  }
  if (tabStats) {
    tabStats.addEventListener("click", function () {
      showTab("stats");
      loadStats();
    });
  }
  if (statsRange) {
    statsRange.addEventListener("change", loadStats);
  }
  if (statsLogBtn) {
    statsLogBtn.addEventListener("click", toggleVisitLog);
  }
  if (statsResetBtn) {
    statsResetBtn.addEventListener("click", function () {
      if (!confirm("Обнулить всю статистику посещений?\n\nСчётчики начнутся с нуля. Заявки и каталог это не затронет.")) return;
      fetch("/api/stats.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password(), action: "reset" })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "Не удалось очистить");
            return data;
          });
        })
        .then(function () {
          showStatus("Статистика обнулена — счёт пошёл заново");
          if (statsLog) {
            statsLog.style.display = "none";
            statsLogBtn.textContent = "Журнал заходов";
          }
          loadStats();
        })
        .catch(function (err) { showStatus(err.message, true); });
    });
  }

  if (motorSearchEl) {
    motorSearchEl.addEventListener("input", function () {
      searchQuery = motorSearchEl.value;
      renderList();
    });
  }

  // ---------- Список моторов ----------
  // Мощность зашита в название модели: Yamaha F25, Honda BF60, Suzuki DF40.
  // Отдельного поля под неё нет, поэтому достаём из названия — так же,
  // как это делает каталог на сайте.
  function motorPower(motor) {
    var title = motor.title || "";
    // У запчастей мощности нет: цифры в артикулах и списках совместимости
    // к ней отношения не имеют, поэтому такие позиции сортируем по названию.
    if (motor.brand === "parts") return null;
    var match = null;
    if (motor.brand === "yamaha") match = title.match(/F\s?(\d{1,3})/i);
    else if (motor.brand === "honda") match = title.match(/BF\s?(\d{1,3})/i);
    else if (motor.brand === "suzuki") match = title.match(/DF\s?(\d{1,3})/i);
    else match = title.match(/\b(\d{1,3})\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  // От слабых к мощным. Позиции без распознанной мощности — запчасти и
  // всё нестандартное — уходят в конец списка, а не мешаются в середине.
  function byPower(list) {
    return list.slice().sort(function (a, b) {
      var pa = motorPower(a);
      var pb = motorPower(b);
      if (pa === null && pb === null) return (a.title || "").localeCompare(b.title || "", "ru");
      if (pa === null) return 1;
      if (pb === null) return -1;
      if (pa !== pb) return pa - pb;
      return (a.title || "").localeCompare(b.title || "", "ru");
    });
  }

  function renderList() {
    formView.style.display = "none";
    listView.style.display = "block";
    renderBrandFilter();

    var shown = visibleMotors();
    // Когда включён фильтр или поиск, показываем «сколько из скольких» —
    // иначе непонятно, куда делись остальные моторы.
    motorCount.textContent = shown.length === currentMotors.length
      ? "Всего моторов: " + currentMotors.length
      : "Показано: " + shown.length + " из " + currentMotors.length;
    // Список разбит на разделы по брендам — менеджеру не приходится
    // выискивать нужный мотор в общей куче. Порядок разделов тот же,
    // что в каталоге на сайте.
    var groups = BRANDS.map(function (b) {
      return {
        key: b.key,
        label: b.label,
        items: byPower(shown.filter(function (m) { return m.brand === b.key; }))
      };
    }).filter(function (g) { return g.items.length; });

    // Мотор с неизвестным брендом не должен потеряться — собираем в конце.
    var known = {};
    BRANDS.forEach(function (b) { known[b.key] = true; });
    var others = byPower(shown.filter(function (m) { return !known[m.brand]; }));
    if (others.length) {
      groups.push({ key: "other", label: "Без бренда", items: others });
    }

    motorList.innerHTML = groups.map(function (g) {
      return (
        '<section class="admin-group" id="group-' + g.key + '">' +
          '<h3 class="admin-group__title">' + g.label +
            '<span class="admin-group__count">' + g.items.length + "</span>" +
          "</h3>" +
          g.items.map(function (m) {
            return (
              '<div class="admin-list__item">' +
                '<img class="admin-list__thumb" src="' + resolveUrl(m.img) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
                '<div class="admin-list__body">' +
                  '<div class="admin-list__title">' + m.title + "</div>" +
                  '<div class="admin-list__meta">' + formatPrice(m.price) +
                    (m.photos && m.photos.length ? ' · 📷 ' + m.photos.length : "") +
                    (m.videos && m.videos.length ? ' · 🎬 ' + m.videos.length : "") +
                  "</div>" +
                "</div>" +
                '<div class="admin-list__actions">' +
                  '<button class="admin-list__edit" data-id="' + m.id + '">Изменить</button>' +
                  '<button class="admin-list__remove" data-id="' + m.id + '" title="Снять с продажи">✕</button>' +
                "</div>" +
              "</div>"
            );
          }).join("") +
        "</section>"
      );
    }).join("") || emptyListMessage();

    motorList.querySelectorAll(".admin-list__edit").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var motor = currentMotors.find(function (m) { return m.id === btn.getAttribute("data-id"); });
        openForm(motor);
      });
    });
    // Удаление прямо из списка: раньше приходилось заходить в мотор,
    // листать форму до низа и только там жать «Удалить».
    motorList.querySelectorAll(".admin-list__remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var motor = currentMotors.find(function (m) { return m.id === id; });
        if (!motor || !confirm("Снять «" + motor.title + "» с продажи?\n\nКарточка уйдёт во вкладку «Продано», откуда её можно вернуть.")) return;
        deleteMotor(id);
      });
    });
  }

  function emptyListMessage() {
    if (searchQuery) return '<p style="color:var(--text-muted);">Ничего не нашлось по запросу «' + searchQuery + '».</p>';
    return '<p style="color:var(--text-muted);">Моторов пока нет — добавьте первый.</p>';
  }

  // Что показываем в списке с учётом выбранного бренда и поиска.
  function visibleMotors() {
    var query = searchQuery.trim().toLowerCase();
    return currentMotors.filter(function (m) {
      if (!query) return true;
      return (m.title || "").toLowerCase().indexOf(query) !== -1;
    });
  }

  // Вкладки брендов работают как якорные ссылки в каталоге: клик прокручивает
  // список к нужному разделу, а не прячет остальные. Так менеджер видит всю
  // картину и при этом попадает куда нужно одним нажатием.
  function renderBrandFilter() {
    if (!brandFilterEl) return;
    var counts = {};
    currentMotors.forEach(function (m) {
      counts[m.brand] = (counts[m.brand] || 0) + 1;
    });

    var tabs = BRANDS.map(function (b) {
      return { key: b.key, label: b.label, count: counts[b.key] || 0 };
    });

    brandFilterEl.innerHTML = tabs.map(function (t) {
      // Пустой раздел показываем приглушённым: сразу видно, где ничего нет.
      var cls = "admin-chip" + (t.count ? "" : " is-empty");
      return '<button type="button" class="' + cls + '" data-brand="' + t.key + '">' +
        t.label + '<span class="admin-chip__count">' + t.count + "</span></button>";
    }).join("");

    brandFilterEl.querySelectorAll(".admin-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-brand");
        // Поиск сбрасываем: иначе нужный раздел может оказаться скрыт фильтром.
        if (searchQuery) {
          searchQuery = "";
          if (searchInput) searchInput.value = "";
          renderList();
        }
        var target = key
          ? document.getElementById("group-" + key)
          : document.querySelector(".admin-toolbar");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // Три плашки кнопками: цвет показан кружком, выбранная подсвечена.
  function renderBadgeChoices() {
    if (!badgeChoicesEl) return;
    badgeChoicesEl.innerHTML = BADGES.map(function (b) {
      var active = (b.text || "") === (fBadge.value || "");
      return '<button type="button" class="badge-choice' + (active ? " is-active" : "") +
        '" data-text="' + escapeAttr(b.text) + '" data-tone="' + b.tone + '">' +
        '<span class="badge-choice__dot" style="background:' + b.css + '"></span>' +
        (b.label || b.text) + "</button>";
    }).join("");
    badgeChoicesEl.querySelectorAll(".badge-choice").forEach(function (btn) {
      btn.addEventListener("click", function () {
        fBadge.value = btn.getAttribute("data-text");
        badgeColor = btn.getAttribute("data-tone");
        renderBadgeChoices();
      });
    });
  }

  // ---------- Продано ----------
  // Снятые с продажи моторы не исчезают: карточка со всеми фото и видео
  // лежит в архиве. Оттуда её возвращают одним нажатием, если сняли по
  // ошибке, и по этому же списку считается, как идут продажи.
  function loadSold() {
    return apiAction("soldList", {})
      .then(function (data) {
        currentSold = data.sold || [];
        renderSold();
      })
      .catch(function (err) { showStatus(err.message, true); });
  }

  function renderSold() {
    soldCount.textContent = currentSold.length
      ? "Продано моторов: " + currentSold.length
      : "Пока ничего не продано";
    renderSoldSummary();

    soldList.innerHTML = currentSold.map(function (m) {
      var when = m.soldAt ? formatDate(m.soldAt) : "";
      return (
        '<div class="admin-list__item">' +
          '<img class="admin-list__thumb" src="' + resolveUrl(m.img) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
          '<div class="admin-list__body">' +
            '<div class="admin-list__title">' + m.title + "</div>" +
            '<div class="admin-list__meta">' + formatPrice(m.soldPrice || m.price) +
              (when ? " · продан " + when : "") + "</div>" +
          "</div>" +
          '<div class="admin-list__actions">' +
            '<button class="admin-list__edit" data-restore="' + m.id + '">Вернуть в каталог</button>' +
            '<button class="admin-list__remove" data-purge="' + m.id + '" title="Удалить навсегда">✕</button>' +
          "</div>" +
        "</div>"
      );
    }).join("") || '<p style="color:var(--text-muted);">Здесь появятся моторы, снятые с продажи.</p>';

    soldList.querySelectorAll("[data-restore]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-restore");
        apiAction("restoreSold", { id: id })
          .then(function (data) {
            currentMotors = data.motors || currentMotors;
            currentSold = data.sold || [];
            renderSold();
            showStatus("Мотор вернулся в каталог");
          })
          .catch(function (err) { showStatus(err.message, true); });
      });
    });
    soldList.querySelectorAll("[data-purge]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-purge");
        var motor = currentSold.find(function (m) { return m.id === id; });
        if (!motor) return;
        if (!confirm("Удалить «" + motor.title + "» навсегда?\n\nВместе с карточкой удалятся её фотографии. Вернуть будет нельзя.")) return;
        apiAction("purgeSold", { id: id })
          .then(function (data) {
            currentSold = data.sold || [];
            renderSold();
            showStatus("Удалено навсегда");
          })
          .catch(function (err) { showStatus(err.message, true); });
      });
    });
  }

  // Сводка по продажам: за месяц, за год и всего, плюс средняя цена.
  function renderSoldSummary() {
    if (!soldSummary) return;
    var now = new Date();
    var monthAgo = new Date(now.getTime() - 30 * 86400000);
    var yearStart = new Date(now.getFullYear(), 0, 1);
    var month = 0, year = 0, sum = 0;
    currentSold.forEach(function (m) {
      var when = m.soldAt ? new Date(m.soldAt) : null;
      var price = Number(m.soldPrice || m.price) || 0;
      sum += price;
      if (when && when >= monthAgo) month++;
      if (when && when >= yearStart) year++;
    });
    var avg = currentSold.length ? Math.round(sum / currentSold.length) : 0;
    soldSummary.innerHTML = [
      { label: "За 30 дней", value: month },
      { label: "С начала года", value: year },
      { label: "Всего продано", value: currentSold.length },
      { label: "Средняя цена", value: formatPrice(avg) }
    ].map(function (c) {
      return '<div class="stats-card"><span class="stats-card__value">' + c.value +
             '</span><span class="stats-card__label">' + c.label + "</span></div>";
    }).join("");
  }

  // ---------- Статистика посещений ----------
  // Считаем сами, без Яндекс.Метрики: цифры простые и честные — сколько
  // заходов, сколько людей, откуда пришли и что смотрели.
  function loadStats() {
    var days = statsRange ? statsRange.value : 30;
    return fetch("/api/stats.php?days=" + days, { headers: { "x-admin-password": password() } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Не удалось получить статистику");
          return data;
        });
      })
      .then(renderStats)
      .catch(function (err) {
        statsCards.innerHTML = '<p style="color:var(--jp-red);">' + err.message + "</p>";
      });
  }

  // Пути превращаем в человеческие названия: «/catalog.html» ни о чём
  // не говорит, а «Каталог» понятно с первого взгляда.
  var PAGE_NAMES = {
    "/": "Главная",
    "/index.html": "Главная",
    "/catalog.html": "Каталог",
    "/order.html": "Оставить заявку",
    "/contacts.html": "Контакты",
    "/delivery.html": "Доставка и оплата",
    "/privacy.html": "Политика обработки данных",
    "/404.html": "Страница не найдена",
    "/panel/": "Панель управления"
  };

  function pageName(path) {
    if (PAGE_NAMES[path]) return PAGE_NAMES[path];
    // Незнакомый адрес показываем как есть, но без расширения и слешей.
    return path.replace(/^\//, "").replace(/\.html$/, "") || "Главная";
  }

  function renderStats(data) {
    var t = data.totals || {};
    statsCards.innerHTML = [
      { label: "Посетителей", value: t.visitors || 0 },
      { label: "Просмотров страниц", value: t.views || 0 },
      { label: "Заявок", value: t.leads || 0 },
      { label: "Посетителей на заявку", value: t.perLead || "—" }
    ].map(function (c) {
      return '<div class="stats-card"><span class="stats-card__value">' + c.value +
             '</span><span class="stats-card__label">' + c.label + "</span></div>";
    }).join("");

    // Столбики рисуем сами: подключать библиотеку графиков ради одного
    // экрана — лишний вес и лишняя зависимость.
    var series = data.series || [];
    var max = series.reduce(function (m, d) { return Math.max(m, d.views); }, 0) || 1;
    statsChart.innerHTML = series.map(function (d) {
      var height = Math.round((d.views / max) * 100);
      var day = d.date.slice(8) + "." + d.date.slice(5, 7);
      return '<div class="stats-bar" title="' + day + ": " + d.visitors + " чел., " + d.views + ' просм.">' +
               '<span class="stats-bar__fill" style="height:' + Math.max(height, 2) + '%"></span>' +
               '<span class="stats-bar__day">' + d.date.slice(8) + "</span>" +
             "</div>";
    }).join("");

    statsSources.innerHTML = renderStatRows(data.sources, "Пока никто не заходил");
    statsPages.innerHTML = renderStatRows(data.pages, "Пока нет просмотров", pageName);
    if (statsRegions) {
      statsRegions.innerHTML = renderStatRows(data.regions, "Пока не определено");
    }
  }

  // Журнал заходов: сводка отвечает «сколько», журнал — «когда и откуда».
  // Открывается по кнопке, чтобы не мешать, когда нужны только цифры.
  function toggleVisitLog() {
    if (statsLog.style.display !== "none") {
      statsLog.style.display = "none";
      statsLogBtn.textContent = "Журнал заходов";
      return;
    }
    statsLogBtn.textContent = "Скрыть журнал";
    statsLog.style.display = "block";
    // Журнал внизу страницы: сам подводим к нему, иначе после нажатия
    // кажется, что ничего не произошло.
    setTimeout(function () {
      statsLog.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    statsLog.innerHTML = '<p style="color:var(--text-muted);">Загружаем…</p>';

    fetch("/api/stats.php?log=1", { headers: { "x-admin-password": password() } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Не удалось получить журнал");
          return data;
        });
      })
      .then(function (data) {
        var visits = data.visits || [];
        if (!visits.length) {
          statsLog.innerHTML = '<p style="color:var(--text-muted);">Заходов пока не было.</p>';
          return;
        }
        statsLog.innerHTML =
          '<div class="stats-log__head"><span>Когда</span><span>Откуда пришёл</span><span>Место</span></div>' +
          visits.map(function (v) {
            return '<div class="stats-log__row">' +
                     "<span>" + formatVisitTime(v.at) + "</span>" +
                     "<span>" + escapeAttr(v.source || "—") + "</span>" +
                     "<span>" + escapeAttr(v.region || "—") + "</span>" +
                   "</div>";
          }).join("") +
          '<p class="stats-log__note">Одна строка — один посетитель. Хранятся последние 300 визитов. ' +
          "Какие страницы смотрят, видно в сводке выше.</p>";
      })
      .catch(function (err) {
        statsLog.innerHTML = '<p style="color:var(--jp-red);">' + err.message + "</p>";
      });
  }

  // «Сегодня, 14:32» читается быстрее, чем полная дата у каждой строки.
  function formatVisitTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    var now = new Date();
    var time = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    var sameDay = d.toDateString() === now.toDateString();
    var yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
    if (sameDay) return "сегодня, " + time;
    if (yesterday) return "вчера, " + time;
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + ", " + time;
  }

  function renderStatRows(map, empty, nameFn) {
    var keys = Object.keys(map || {});
    if (!keys.length) return '<p style="color:var(--text-muted);">' + empty + "</p>";
    var max = keys.reduce(function (m, k) { return Math.max(m, map[k]); }, 0) || 1;
    return keys.map(function (k) {
      var width = Math.round((map[k] / max) * 100);
      return '<div class="stats-row">' +
               '<span class="stats-row__label">' + escapeAttr(nameFn ? nameFn(k) : k) + "</span>" +
               '<span class="stats-row__track"><span style="width:' + width + '%"></span></span>' +
               '<span class="stats-row__value">' + map[k] + "</span>" +
             "</div>";
    }).join("");
  }

  // Общий вызов панели: одно место, где собирается пароль и разбирается ответ.
  function apiAction(action, extra) {
    var body = { password: password(), action: action };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Ошибка запроса");
        return data;
      });
    });
  }

  function showStatus(text, isError) {
    statusMsg.textContent = text;
    statusMsg.className = "admin-status " + (isError ? "admin-status--error" : "admin-status--ok");
    setTimeout(function () { statusMsg.textContent = ""; }, 4000);
  }

  // ---------- Заявки ----------
  function loadLeads() {
    fetch(LEADS_URL, { headers: { "x-admin-password": password() } })
      .then(function (res) { return res.ok ? res.json() : { leads: [] }; })
      .then(function (data) {
        currentLeads = data.leads || [];
        updateLeadsBadge();
        if (leadsView.style.display !== "none") renderLeads();
      })
      .catch(function () {});
  }

  function updateLeadsBadge() {
    var unread = currentLeads.filter(function (l) { return !l.viewed; }).length;
    if (unread > 0) {
      leadsBadge.textContent = unread;
      leadsBadge.style.display = "inline-block";
    } else {
      leadsBadge.style.display = "none";
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function showLeadsStatus(text, isError) {
    leadsStatusMsg.textContent = text;
    leadsStatusMsg.className = "admin-status " + (isError ? "admin-status--error" : "admin-status--ok");
    setTimeout(function () { leadsStatusMsg.textContent = ""; }, 4000);
  }

  function renderLeads() {
    leadsCount.textContent = "Всего заявок: " + currentLeads.length;
  // В поле motor лежит строка вида «<конкретный мотор> · <параметры подбора>».
  // Параметры уже показаны таблицей, поэтому из строки достаём только ту часть,
  // где клиент назвал конкретную модель, — иначе одно и то же выводилось бы дважды.
  function exactMotorOf(lead) {
    var motor = (lead.motor || "").trim();
    if (!motor) return "";
    var spec = lead.spec || {};
    var keys = Object.keys(spec);
    if (!keys.length) return motor;
    var specLine = keys.map(function (key) {
      var value = spec[key];
      return key + ": " + (Array.isArray(value) ? value.join(", ") : value);
    }).join(" · ");
    if (motor === specLine) return "";
    return motor.replace(" · " + specLine, "").replace(specLine, "").trim();
  }

    leadsList.innerHTML = currentLeads.map(function (l) {
      return (
        '<div class="admin-lead' + (l.viewed ? "" : " is-new") + '" data-id="' + l.id + '">' +
          '<div class="admin-lead__top">' +
            '<div><span class="admin-lead__name">' + l.name + "</span>" +
              (l.viewed ? "" : '<span class="admin-lead__new-tag">новая</span>') +
            "</div>" +
            '<div class="admin-lead__date">' + formatDate(l.createdAt) + "</div>" +
          "</div>" +
          '<div class="admin-lead__row">📞 <a href="tel:' + l.phone + '">' + l.phone + "</a></div>" +
          (l.messengers && l.messengers.length
            ? '<div class="admin-lead__row">💬 ' + l.messengers.join(", ") + "</div>"
            : "") +
          (l.email ? '<div class="admin-lead__row">✉️ <a href="mailto:' + l.email + '">' + l.email + "</a></div>" : "") +
          (exactMotorOf(l) ? '<div class="admin-lead__row">🛥️ ' + exactMotorOf(l) + "</div>" : "") +
          (l.spec && Object.keys(l.spec).length
            ? '<div class="admin-lead__spec">' +
                Object.keys(l.spec).map(function (key) {
                  var value = l.spec[key];
                  return '<div class="admin-lead__spec-row"><em>' + key + "</em><b>" +
                    (Array.isArray(value) ? value.join(", ") : value) + "</b></div>";
                }).join("") +
              "</div>"
            : "") +
          (l.message ? '<div class="admin-lead__message">' + l.message + "</div>" : "") +
          (l.consent ? '<div class="admin-lead__consent" title="' + escapeAttr(l.consent) +
            '">✓ согласие получено при отправке</div>' : "") +
          '<div class="admin-lead__actions">' +
            '<button class="admin-lead__btn admin-lead__btn--toggle" data-id="' + l.id + '" data-viewed="' + (!l.viewed) + '">' +
              (l.viewed ? "Отметить непросмотренной" : "Отметить просмотренной") +
            "</button>" +
            '<button class="admin-lead__btn admin-lead__btn--delete" data-id="' + l.id + '">Удалить</button>' +
          "</div>" +
        "</div>"
      );
    }).join("") || '<p style="color:var(--text-muted);">Заявок пока нет.</p>';

    leadsList.querySelectorAll(".admin-lead__btn--toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var viewed = btn.getAttribute("data-viewed") === "true";
        fetch(LEADS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password(), action: "markViewed", id: id, viewed: viewed })
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            currentLeads = data.leads || currentLeads;
            updateLeadsBadge();
            renderLeads();
          })
          .catch(function () { showLeadsStatus("Ошибка обновления", true); });
      });
    });

    leadsList.querySelectorAll(".admin-lead__btn--delete").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("Удалить эту заявку?")) return;
        var id = btn.getAttribute("data-id");
        fetch(LEADS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password(), action: "delete", id: id })
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            currentLeads = data.leads || currentLeads;
            updateLeadsBadge();
            renderLeads();
            showLeadsStatus("Заявка удалена");
          })
          .catch(function () { showLeadsStatus("Ошибка удаления", true); });
      });
    });
  }

  // ---------- Форма ----------
  newMotorBtn.addEventListener("click", function () { openForm(null); });
  backBtn.addEventListener("click", renderList);

  function openForm(motor) {
    motorForm.reset();
    fId.value = motor ? motor.id : "";
    fBrand.value = motor ? motor.brand : "yamaha";
    fTitle.value = motor ? motor.title : "";
    fPrice.value = motor ? motor.price : "";
    fBadge.value = motor && motor.badge ? motor.badge : "";
    badgeColor = motor && motor.badgeColor ? motor.badgeColor : "";
    renderBadgeChoices();
    formTitle.textContent = motor ? "Редактирование мотора" : "Новый мотор";
    deleteBtn.style.display = motor ? "inline-block" : "none";

    photoState = motor && motor.photos ? motor.photos.map(function (url) {
      return { type: "existing", url: url, isMain: url === motor.img };
    }) : [];
    draftId = "";
    videoState = motor && motor.videos ? motor.videos.map(function (v) {
      if (typeof v === "string") return { label: v, url: "", poster: "", duration: 0 };
      return { label: v.label || "", url: v.url || "", poster: v.poster || "", duration: v.duration || 0 };
    }) : [];
    loadSpecs(motor && motor.specs ? motor.specs.map(function (s) { return [s[0], s[1]]; }) : []);

    renderPhotos();
    renderVideos();
    renderSpecs();

    listView.style.display = "none";
    formView.style.display = "block";
    window.scrollTo(0, 0);
  }

  // ---------- Фото ----------
  photoDrop.addEventListener("click", function () { photoInput.click(); });
  photoDrop.addEventListener("dragover", function (e) { e.preventDefault(); photoDrop.classList.add("dragover"); });
  photoDrop.addEventListener("dragleave", function () { photoDrop.classList.remove("dragover"); });
  photoDrop.addEventListener("drop", function (e) {
    e.preventDefault();
    photoDrop.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  photoInput.addEventListener("change", function () {
    handleFiles(photoInput.files);
    photoInput.value = "";
  });

  function handleFiles(fileList) {
    Array.prototype.forEach.call(fileList, function (file) {
      if (!/^image\//.test(file.type)) return;
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = reader.result.split(",")[1];
        photoState.push({
          type: "new",
          filename: file.name,
          dataBase64: base64,
          previewUrl: reader.result,
          isMain: photoState.length === 0
        });
        renderPhotos();
      };
      reader.readAsDataURL(file);
    });
  }

  // Перестановка соседних элементов: порядок в каталоге ровно такой, как здесь.
  function moveItem(list, from, to) {
    if (to < 0 || to >= list.length) return false;
    var item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    return true;
  }

  function renderPhotos() {
    photoListEl.innerHTML = photoState.map(function (p, i) {
      var src = p.type === "new" ? p.previewUrl : resolveUrl(p.url);
      return (
        '<div class="admin-photo-item' + (p.isMain ? " is-main" : "") + '" data-i="' + i + '">' +
          '<img src="' + src + '" alt="">' +
          '<button type="button" class="admin-photo-item__star" data-i="' + i + '" title="Сделать главной">★</button>' +
          '<button type="button" class="admin-photo-item__remove" data-i="' + i + '" title="Удалить">✕</button>' +
          '<div class="admin-photo-item__order">' +
            '<button type="button" class="admin-move" data-move="up" data-i="' + i + '"' +
              (i === 0 ? " disabled" : "") + ' title="Левее">‹</button>' +
            '<span class="admin-photo-item__num">' + (i + 1) + "</span>" +
            '<button type="button" class="admin-move" data-move="down" data-i="' + i + '"' +
              (i === photoState.length - 1 ? " disabled" : "") + ' title="Правее">›</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    photoListEl.querySelectorAll(".admin-photo-item__star").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-i"), 10);
        photoState.forEach(function (p, j) { p.isMain = (j === i); });
        renderPhotos();
      });
    });
    photoListEl.querySelectorAll(".admin-photo-item__order .admin-move").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-i"), 10);
        var to = btn.getAttribute("data-move") === "up" ? i - 1 : i + 1;
        if (moveItem(photoState, i, to)) renderPhotos();
      });
    });
    photoListEl.querySelectorAll(".admin-photo-item__remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-i"), 10);
        var wasMain = photoState[i].isMain;
        photoState.splice(i, 1);
        if (wasMain && photoState.length) photoState[0].isMain = true;
        renderPhotos();
      });
    });
  }

  // ---------- Видео ----------
  // ---------- Видео ----------
  // У менеджера ролик лежит файлом на компьютере, а не ссылкой в интернете.
  // Поэтому файл выбирается кнопкой и уходит на сервер отдельным запросом:
  // видео весит десятки мегабайт, в общей форме такой объём не пройдёт.

  var VIDEO_UPLOAD_URL = "/api/upload_video.php";

  // Обложку снимаем прямо в браузере: берём кадр с третьей секунды и
  // отправляем вместе с роликом. На хостинге сделать это нечем.
  function grabPoster(file) {
    return new Promise(function (resolve) {
      var video = document.createElement("video");
      var url = URL.createObjectURL(file);
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        resolve(value);
      }
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      video.addEventListener("loadeddata", function () {
        // Первый кадр часто чёрный, поэтому отматываем чуть вперёд.
        try { video.currentTime = Math.min(3, (video.duration || 4) / 2); } catch (e) { finish(null); }
      });
      video.addEventListener("seeked", function () {
        try {
          var canvas = document.createElement("canvas");
          var scale = Math.min(1, 640 / (video.videoWidth || 640));
          canvas.width = Math.round((video.videoWidth || 640) * scale);
          canvas.height = Math.round((video.videoHeight || 360) * scale);
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          finish({ poster: canvas.toDataURL("image/jpeg", 0.72), duration: Math.round(video.duration || 0) });
        } catch (e) {
          finish(null);
        }
      });
      video.addEventListener("error", function () { finish(null); });
      // Не ждём вечно: если браузер не смог открыть файл, грузим ролик без обложки.
      setTimeout(function () { finish(null); }, 15000);
    });
  }

  function uploadVideo(file, index) {
    var row = videoListEl.querySelector('.admin-video-row[data-i="' + index + '"]');
    var progress = row ? row.querySelector(".admin-video__progress span") : null;
    var status = row ? row.querySelector(".admin-video__status") : null;

    function setStatus(text) { if (status) status.textContent = text; }

    setStatus("готовим обложку…");
    return grabPoster(file).then(function (shot) {
      return new Promise(function (resolve, reject) {
        var form = new FormData();
        form.append("password", password());
        form.append("motorId", fId.value || currentDraftId());
        form.append("video", file, file.name);
        if (shot && shot.poster) form.append("poster", shot.poster);

        var xhr = new XMLHttpRequest();
        xhr.open("POST", VIDEO_UPLOAD_URL);
        xhr.upload.addEventListener("progress", function (e) {
          if (!e.lengthComputable) return;
          var percent = Math.round((e.loaded / e.total) * 100);
          if (progress) progress.style.width = percent + "%";
          setStatus("загрузка " + percent + "%");
        });
        xhr.addEventListener("load", function () {
          var data = {};
          try { data = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status !== 200 || !data.ok) {
            reject(new Error(data.error || "ошибка загрузки"));
            return;
          }
          resolve({ url: data.url, poster: data.poster || "", duration: shot ? shot.duration : 0 });
        });
        xhr.addEventListener("error", function () { reject(new Error("нет связи с сервером")); });
        xhr.send(form);
      });
    });
  }

  // Пока мотор не сохранён, у него ещё нет id — заводим временный,
  // чтобы файлы сразу легли в отдельную папку и не смешались с чужими.
  var draftId = "";
  function currentDraftId() {
    if (!draftId) draftId = "m" + Date.now();
    return draftId;
  }

  videoDrop.addEventListener("click", function () {
    videoInput.value = "";
    videoInput.click();
  });
  videoDrop.addEventListener("dragover", function (e) {
    e.preventDefault();
    videoDrop.classList.add("dragover");
  });
  videoDrop.addEventListener("dragleave", function () { videoDrop.classList.remove("dragover"); });
  videoDrop.addEventListener("drop", function (e) {
    e.preventDefault();
    videoDrop.classList.remove("dragover");
    handleVideoFiles(e.dataTransfer.files);
  });

  videoInput.addEventListener("change", function () {
    handleVideoFiles(videoInput.files);
    videoInput.value = "";
  });

  function handleVideoFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (file) {
      // Из папки могут перетащить что угодно — берём только видео.
      return /^video\//.test(file.type) || /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(file.name);
    });
    if (!files.length) {
      showStatus("Это не видеофайлы — перенесите ролики в формате MP4 или MOV", true);
      return;
    }
    files.forEach(function (file) {
      // Название по умолчанию — имя файла без расширения: менеджеру
      // останется поправить его, а не печатать с нуля.
      var label = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      // Ссылка на файл с диска: по ней ролик можно посмотреть сразу, не дожидаясь
      // окончания загрузки, — иначе непонятно, как его называть.
      var localUrl = "";
      try { localUrl = URL.createObjectURL(file); } catch (e) {}
      videoState.push({ label: label, url: "", poster: "", duration: 0,
                        uploading: true, error: "", localUrl: localUrl });
      var index = videoState.length - 1;
      renderVideos();

      uploadVideo(file, index).then(function (result) {
        videoState[index].url = result.url;
        videoState[index].poster = result.poster;
        videoState[index].duration = result.duration;
        videoState[index].uploading = false;
        renderVideos();
        // Иногда кадр снять до отправки не удаётся: браузер не берётся
        // декодировать файл с диска (так бывает с роликами с айфона).
        // После загрузки файл лежит на сервере — пробуем ещё раз уже оттуда.
        if (!result.poster && result.url) {
          makePosterFromUrl(result.url).then(function (shot) {
            if (!shot) return;
            return savePoster(result.url, shot.poster).then(function (posterUrl) {
              if (!posterUrl) return;
              videoState[index].poster = posterUrl;
              if (!videoState[index].duration) videoState[index].duration = shot.duration;
              renderVideos();
            });
          });
        }
      }).catch(function (err) {
        videoState[index].uploading = false;
        videoState[index].error = err.message;
        renderVideos();
      });
    });
  }

  function formatDuration(seconds) {
    if (!seconds) return "";
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // Снимает кадр из ролика, уже лежащего на сервере: там он отдаётся как
  // обычное видео, и браузер декодирует его без проблем.
  function makePosterFromUrl(url) {
    return new Promise(function (resolve) {
      var video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      var done = false;
      function finish(result) {
        if (done) return;
        done = true;
        video.removeAttribute("src");
        resolve(result);
      }
      video.addEventListener("loadeddata", function () {
        // Первый кадр часто чёрный — берём чуть позже.
        try { video.currentTime = Math.min(1, (video.duration || 2) / 3); } catch (e) { finish(null); }
      });
      video.addEventListener("seeked", function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = Math.round(640 * (video.videoHeight || 360) / (video.videoWidth || 640));
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          finish({ poster: canvas.toDataURL("image/jpeg", 0.72), duration: Math.round(video.duration || 0) });
        } catch (e) {
          finish(null);
        }
      });
      video.addEventListener("error", function () { finish(null); });
      setTimeout(function () { finish(null); }, 15000);
      video.src = url;
    });
  }

  function savePoster(videoUrl, posterData) {
    var form = new FormData();
    form.append("password", password());
    form.append("action", "poster");
    form.append("motorId", fId.value || currentDraftId());
    form.append("name", videoUrl.split("/").pop());
    form.append("poster", posterData);
    return fetch(VIDEO_UPLOAD_URL, { method: "POST", body: form })
      .then(function (res) { return res.json(); })
      .then(function (data) { return data && data.poster ? data.poster : ""; })
      .catch(function () { return ""; });
  }

  // Окно просмотра ролика: пока файл грузится — играем прямо с диска,
  // после загрузки — с сервера, чтобы заодно убедиться, что он доехал целым.
  function openVideoPreview(video) {
    var src = video.url ? resolveUrl(video.url) : video.localUrl;
    if (!src) return;

    var overlay = document.createElement("div");
    overlay.className = "video-preview";
    overlay.innerHTML =
      '<div class="video-preview__box">' +
        '<div class="video-preview__title">' + escapeAttr(video.label || "Без названия") + "</div>" +
        '<video src="' + escapeAttr(src) + '" controls autoplay playsinline ' +
          'controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture></video>' +
        '<button type="button" class="video-preview__close">Закрыть</button>' +
      "</div>";

    function close() {
      var player = overlay.querySelector("video");
      if (player) player.pause();
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.classList.contains("video-preview__close")) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  function renderVideos() {
    videoListEl.innerHTML = videoState.map(function (v, i) {
      // Обложку показываем, как только она есть; пока её нет — заглушка.
      // И то и другое кликабельно: ролик открывается в окошке просмотра.
      var playable = v.url || v.localUrl;
      // Если обложка не снялась, показываем кадр из самого ролика — так
      // менеджер всё равно видит, что загрузил, и может дать название.
      var inner;
      if (v.poster) {
        inner = '<img src="' + escapeAttr(resolveUrl(v.poster)) + '" alt="">';
      } else if (playable) {
        inner = '<video class="admin-video__frame" src="' + escapeAttr(playable) + '#t=1"' +
                ' preload="metadata" muted playsinline></video>';
      } else {
        inner = '<span class="admin-video__cover-empty">🎬</span>';
      }
      var cover = playable
        ? '<button type="button" class="admin-video__cover admin-video__cover--play" data-play="' + i + '"' +
          ' title="Посмотреть ролик">' + inner + '<span class="admin-video__play">▶</span></button>'
        : '<span class="admin-video__cover">' + inner + "</span>";

      var state;
      if (v.uploading) {
        state = '<div class="admin-video__progress"><span></span></div>' +
                '<div class="admin-video__status">загрузка…</div>';
      } else if (v.error) {
        state = '<div class="admin-video__status admin-video__status--error">не загрузилось: ' + escapeAttr(v.error) + "</div>";
      } else if (v.url) {
        state = '<div class="admin-video__status admin-video__status--ok">на сервере' +
                (v.duration ? " · " + formatDuration(v.duration) : "") + "</div>";
      } else {
        state = '<div class="admin-video__status">файл не выбран</div>';
      }

      return (
        '<div class="admin-video-row" data-i="' + i + '">' +
          '<div class="admin-video__order">' +
            '<button type="button" class="admin-move" data-vmove="up" data-i="' + i + '"' +
              (i === 0 ? " disabled" : "") + ' title="Выше">‹</button>' +
            '<span class="admin-video__num">' + (i + 1) + "</span>" +
            '<button type="button" class="admin-move" data-vmove="down" data-i="' + i + '"' +
              (i === videoState.length - 1 ? " disabled" : "") + ' title="Ниже">›</button>' +
          "</div>" +
          cover +
          '<div class="admin-video__body">' +
            '<input type="text" class="form-control video-label" placeholder="Название, напр. «Запуск двигателя»" value="' + escapeAttr(v.label) + '">' +
            state +
          "</div>" +
          '<button type="button" class="admin-row-remove" data-i="' + i + '" title="Убрать">✕</button>' +
        "</div>"
      );
    }).join("");

    videoListEl.querySelectorAll("[data-play]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = videoState[parseInt(btn.getAttribute("data-play"), 10)];
        if (v) openVideoPreview(v);
      });
    });

    videoListEl.querySelectorAll(".admin-video-row").forEach(function (row) {
      var i = parseInt(row.getAttribute("data-i"), 10);
      row.querySelector(".video-label").addEventListener("input", function (e) {
        videoState[i].label = e.target.value;
      });
    });
    videoListEl.querySelectorAll("[data-vmove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-i"), 10);
        var to = btn.getAttribute("data-vmove") === "up" ? i - 1 : i + 1;
        if (moveItem(videoState, i, to)) renderVideos();
      });
    });
    videoListEl.querySelectorAll(".admin-row-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        videoState.splice(parseInt(btn.getAttribute("data-i"), 10), 1);
        renderVideos();
      });
    });
  }

  // ---------- Характеристики ----------
  // Шаблон из 11 пунктов — одинаковый для всех моторов и всегда в этом порядке.
  // Где вариантов немного, они выбираются из списка; «Другое…» открывает поле ввода,
  // так что вписать нестандартное значение по-прежнему можно.
  // Тот же порядок используется на сайте — см. tools/normalize_specs.py.
  var SPEC_TEMPLATE = [
    { label: "Год", placeholder: "напр. 2019" },
    { label: "Состояние", options: ["новый", "б/у"] },
    { label: "Тактность", options: ["4-тактный", "2-тактный"] },
    { label: "Длина ноги", options: ["S (381 мм)", "L (508 мм)", "X (635 мм)"] },
    { label: "Подъем", options: ["гидравлический", "ручной", "ручной (гидродемпфер)", "ручной (демпфер)"] },
    { label: "Компрессия", placeholder: "напр. 15/15/15" },
    { label: "Наработка", placeholder: "напр. 415", suffix: "м/час" },
    { label: "Управление", options: ["дистанционное", "румпельное", "ручное"] },
    { label: "Комплект", options: ["машинка управления", "пульт управления", "мультирумпель", "без комплекта"] },
    { label: "Возможность увеличения мощности", options: ["до 20 л.с.", "до 40 л.с.", "до 60 л.с.", "до 90 л.с.", "нет"] }
  ];
  var TEMPLATE_LABELS = SPEC_TEMPLATE.map(function (f) { return f.label; });

  // «415 м/час» -> «415»: в поле показываем только число, единица нарисована рядом.
  function stripSuffix(value, suffix) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return "";
    // Старые записи приходят как «415 моточасов», «415 мч», «415 м/час».
    return text.replace(/\s*(м\/час(ов)?|моточас\w*|мч|ч(ас\w*)?)\s*$/i, "").trim();
  }

  function isPartsBrand() {
    return fBrand.value === "parts";
  }

  // Значения шаблона и «свои» характеристики держим отдельно от specState:
  // иначе при перерисовке формы (например, после переключения бренда на запчасти
  // и обратно) заполненные пункты шаблона потерялись бы.
  var templateValues = {};
  var customSpecs = [];

  // Раскладывает specs мотора на шаблонную часть и всё остальное.
  function loadSpecs(specs) {
    templateValues = {};
    customSpecs = [];
    (specs || []).forEach(function (s) {
      if (TEMPLATE_LABELS.indexOf(s[0]) !== -1 && templateValues[s[0]] === undefined) templateValues[s[0]] = s[1];
      else customSpecs.push([s[0], s[1]]);
    });
    collectSpecs();
  }

  // Собирает specState: сначала 11 пунктов шаблона по порядку, потом свои.
  function collectSpecs() {
    var result = [];
    if (!isPartsBrand()) {
      TEMPLATE_LABELS.forEach(function (label) {
        result.push([label, templateValues[label] || ""]);
      });
    }
    specState = result.concat(customSpecs);
  }

  addSpecBtn.addEventListener("click", function () {
    customSpecs.push(["", ""]);
    collectSpecs();
    renderSpecs();
  });

  fBrand.addEventListener("change", function () {
    collectSpecs();
    renderSpecs();
  });

  function renderSpecs() {
    var byLabel = templateValues;
    var custom = customSpecs;

    var html = "";

    if (!isPartsBrand()) {
      html += SPEC_TEMPLATE.map(function (field, i) {
        var value = byLabel[field.label] || "";
        var control;
        if (field.options) {
          var known = field.options.indexOf(value) !== -1;
          var isOther = value !== "" && !known;
          control =
            '<select class="form-control spec-select" data-label="' + escapeAttr(field.label) + '">' +
              '<option value=""' + (value === "" ? " selected" : "") + ">— не указано</option>" +
              field.options.map(function (opt) {
                return '<option value="' + escapeAttr(opt) + '"' + (opt === value ? " selected" : "") + ">" + opt + "</option>";
              }).join("") +
              '<option value="__other__"' + (isOther ? " selected" : "") + ">Другое…</option>" +
            "</select>" +
            '<input type="text" class="form-control spec-other" data-label="' + escapeAttr(field.label) + '"' +
              ' placeholder="свой вариант" value="' + escapeAttr(isOther ? value : "") + '"' +
              (isOther ? "" : ' style="display:none;"') + ">";
        } else if (field.suffix) {
          // Единицу измерения дописываем сами: менеджер вводит только число,
          // а в каталог уходит «415 м/час» — без разнобоя вроде «моточасов»,
          // «мч» и «415 часов».
          control =
            '<div class="admin-suffix-field">' +
              '<input type="text" class="form-control spec-text" data-label="' + escapeAttr(field.label) + '"' +
                ' data-suffix="' + escapeAttr(field.suffix) + '" inputmode="numeric"' +
                ' placeholder="' + escapeAttr(field.placeholder || "") + '" value="' + escapeAttr(stripSuffix(value, field.suffix)) + '">' +
              '<span class="admin-suffix-field__unit">' + field.suffix + "</span>" +
            "</div>";
        } else {
          control =
            '<input type="text" class="form-control spec-text" data-label="' + escapeAttr(field.label) + '"' +
              ' placeholder="' + escapeAttr(field.placeholder || "") + '" value="' + escapeAttr(value) + '">';
        }
        return (
          '<div class="admin-spec-row admin-spec-row--fixed">' +
            '<span class="admin-spec-label">' + (i + 1) + ". " + field.label + "</span>" +
            '<div class="admin-spec-control">' + control + "</div>" +
          "</div>"
        );
      }).join("");
    }

    html += custom.map(function (s, ci) {
      return (
        '<div class="admin-spec-row admin-spec-row--custom" data-ci="' + ci + '">' +
          '<input type="text" class="form-control spec-key" placeholder="Своя характеристика" value="' + escapeAttr(s[0]) + '">' +
          '<input type="text" class="form-control spec-val" placeholder="Значение" value="' + escapeAttr(s[1]) + '">' +
          '<button type="button" class="admin-row-remove" data-ci="' + ci + '">✕</button>' +
        "</div>"
      );
    }).join("");

    specListEl.innerHTML = html;

    specListEl.querySelectorAll(".spec-select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var label = sel.getAttribute("data-label");
        var other = specListEl.querySelector('.spec-other[data-label="' + label + '"]');
        if (sel.value === "__other__") {
          other.style.display = "";
          other.focus();
          byLabel[label] = other.value.trim();
        } else {
          other.style.display = "none";
          other.value = "";
          byLabel[label] = sel.value;
        }
        collectSpecs();
      });
    });
    specListEl.querySelectorAll(".spec-other, .spec-text").forEach(function (input) {
      input.addEventListener("input", function () {
        var suffix = input.getAttribute("data-suffix");
        var typed = input.value.trim();
        byLabel[input.getAttribute("data-label")] = suffix && typed ? typed + " " + suffix : typed;
        collectSpecs();
      });
    });
    specListEl.querySelectorAll(".admin-spec-row--custom").forEach(function (row) {
      var ci = parseInt(row.getAttribute("data-ci"), 10);
      row.querySelector(".spec-key").addEventListener("input", function (e) {
        custom[ci][0] = e.target.value;
        collectSpecs();
      });
      row.querySelector(".spec-val").addEventListener("input", function (e) {
        custom[ci][1] = e.target.value;
        collectSpecs();
      });
    });
    specListEl.querySelectorAll(".admin-row-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        custom.splice(parseInt(btn.getAttribute("data-ci"), 10), 1);
        collectSpecs();
        renderSpecs();
      });
    });
  }

  function escapeAttr(str) {
    return String(str == null ? "" : str).replace(/"/g, "&quot;");
  }

  // ---------- Сохранение ----------
  motorForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var submitBtn = motorForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Сохраняем…";

    var motor = {
      id: fId.value || null,
      brand: fBrand.value,
      title: fTitle.value.trim(),
      price: fPrice.value,
      badge: fBadge.value.trim(),
      badgeColor: badgeColor,
      photos: photoState.map(function (p) {
        return p.type === "new"
          ? { type: "new", filename: p.filename, dataBase64: p.dataBase64, isMain: !!p.isMain }
          : { type: "existing", url: p.url, isMain: !!p.isMain };
      }),
      // Незагруженные и сломавшиеся ролики не сохраняем — иначе на сайте
      // появится плитка, которая никуда не ведёт.
      videos: videoState.filter(function (v) { return v.url && v.label.trim(); }).map(function (v) {
        return { label: v.label.trim(), url: v.url, poster: v.poster || "", duration: v.duration || 0 };
      }),
      // Шаблонные пункты сохраняем даже пустыми, чтобы список характеристик
      // у всех моторов оставался одинаковым; из своих отбрасываем безымянные.
      specs: specState.filter(function (s) {
        return TEMPLATE_LABELS.indexOf(s[0]) !== -1 || s[0].trim();
      })
    };

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password(), action: "save", motor: motor })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || "Ошибка сохранения"); });
        return res.json();
      })
      .then(function (data) {
        currentMotors = data.motors || [];
        renderList();
        showStatus("Сохранено: " + (data.saved ? data.saved.title : motor.title));
      })
      .catch(function (err) {
        showStatus(err.message, true);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Сохранить";
      });
  });

  // ---------- Удаление ----------
  function deleteMotor(id) {
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password(), action: "delete", id: id })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || "Ошибка удаления"); });
        return res.json();
      })
      .then(function (data) {
        currentMotors = data.motors || [];
        renderList();
        showStatus("Мотор снят с продажи — карточка во вкладке «Продано»");
      })
      .catch(function (err) {
        showStatus(err.message, true);
      });
  }

  deleteBtn.addEventListener("click", function () {
    if (!fId.value) return;
    if (!confirm("Удалить этот мотор? Действие нельзя отменить.")) return;

    deleteBtn.disabled = true;
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password(), action: "delete", id: fId.value })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || "Ошибка удаления"); });
        return res.json();
      })
      .then(function (data) {
        currentMotors = data.motors || [];
        renderList();
        showStatus("Мотор удалён");
      })
      .catch(function (err) {
        showStatus(err.message, true);
      })
      .finally(function () {
        deleteBtn.disabled = false;
      });
  });
})();
