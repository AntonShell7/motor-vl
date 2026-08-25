// ===== МОТОР-ВЛ: общие скрипты для всех страниц =====

// ===== Счётчик посещений =====
// Свой, без сторонних сервисов: сообщаем серверу адрес страницы и откуда
// пришёл посетитель. Ошибка отправки ничего не ломает — счётчик не должен
// мешать сайту работать.
(function () {
  try {
    // Часовой пояс браузера даёт примерную географию без обращения к чужим
    // сервисам и без запроса разрешения у посетителя: «Asia/Vladivostok»
    // на сервере превращается в «Владивосток и Приморье».
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var body = JSON.stringify({ page: location.pathname, ref: document.referrer || "", tz: tz });
    // sendBeacon уходит фоном и не задерживает загрузку страницы.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/hit.php", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/hit.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true
      }).catch(function () {});
    }
  } catch (e) { /* счётчик не важнее сайта */ }
})();

document.addEventListener("DOMContentLoaded", function () {

  /* ---------- Мобильное меню ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.querySelector(".mobile-nav");
  var mobileNavClose = document.querySelector(".mobile-nav__close");

  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      mobileNav.classList.add("open");
    });
  }
  if (mobileNavClose && mobileNav) {
    mobileNavClose.addEventListener("click", function () {
      mobileNav.classList.remove("open");
    });
    mobileNav.addEventListener("click", function (e) {
      if (e.target === mobileNav) mobileNav.classList.remove("open");
    });
  }

  /* ---------- Появление блоков при прокрутке ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Счётчики цифр (18 лет, отзывы и т.д.) ---------- */
  var counters = document.querySelectorAll("[data-counter]");
  counters.forEach(function (el) {
    var target = parseInt(el.getAttribute("data-counter"), 10);
    var started = false;
    var run = function () {
      if (started) return;
      started = true;
      var current = 0;
      var step = Math.max(1, Math.ceil(target / 40));
      var timer = setInterval(function () {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = current.toLocaleString("ru-RU");
      }, 30);
    };
    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { run(); obs.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      obs.observe(el);
    } else {
      run();
    }
  });

  /* ---------- Отзывы: лента с кнопками ---------- */
  var track = document.querySelector(".reviews-track");
  var prevBtn = document.querySelector("[data-review-prev]");
  var nextBtn = document.querySelector("[data-review-next]");
  if (track && prevBtn && nextBtn) {
    var scrollAmount = 344;
    prevBtn.addEventListener("click", function () {
      track.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
    nextBtn.addEventListener("click", function () {
      track.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }

  /* ---------- Аккордеон (FAQ) ---------- */
  document.querySelectorAll(".accordion-item__head").forEach(function (head) {
    head.addEventListener("click", function () {
      var item = head.closest(".accordion-item");
      var body = item.querySelector(".accordion-item__body");
      var isOpen = item.classList.contains("open");

      document.querySelectorAll(".accordion-item.open").forEach(function (other) {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".accordion-item__body").style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove("open");
        body.style.maxHeight = null;
      } else {
        item.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });

  /* ---------- Кнопка "наверх" ---------- */
  var backToTop = document.querySelector(".back-to-top");
  if (backToTop) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 500) backToTop.classList.add("show");
      else backToTop.classList.remove("show");
    });
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Лайтбокс: фотогалерея и видео мотора ---------- */
  var lightbox = document.querySelector(".lightbox");
  var lightboxReady = lightbox &&
    lightbox.querySelector(".lightbox__stage img") &&
    lightbox.querySelector(".lightbox__close") &&
    lightbox.querySelector(".lightbox__nav--prev") &&
    lightbox.querySelector(".lightbox__nav--next");
  if (lightboxReady) {
    var stageImg = lightbox.querySelector(".lightbox__stage img");
    var counterEl = lightbox.querySelector(".lightbox__counter");
    var captionEl = lightbox.querySelector(".lightbox__caption");
    var thumbsEl = lightbox.querySelector(".lightbox__thumbs");
    var videosEl = lightbox.querySelector(".lightbox__videos");
    var closeBtn = lightbox.querySelector(".lightbox__close");
    var prevBtn = lightbox.querySelector(".lightbox__nav--prev");
    var nextBtn = lightbox.querySelector(".lightbox__nav--next");

    var state = { photos: [], index: 0 };

    var viewport = lightbox.querySelector(".lightbox__viewport") || stageImg.parentNode;
    var stage = lightbox.querySelector(".lightbox__stage");
    var lightboxBox = lightbox.querySelector(".lightbox__box");
    var zoomBar = lightbox.querySelector(".lightbox__zoom");
    var zoomLevelEl = lightbox.querySelector(".lightbox__zoom-level");
    var zoomHintEl = lightbox.querySelector(".lightbox__zoom-hint");
    var zoomBtns = lightbox.querySelectorAll("[data-zoom]");

    // ---- Масштабирование ----
    // scale — во сколько раз увеличено, tx/ty — сдвиг картинки внутри окна.
    // Трансформация вешается на само фото (или видео), поэтому зум работает
    // и для роликов, а не только для снимков.
    var MIN_SCALE = 1;
    // Фотографии в каталоге — оригиналы 900x1200, дальше 140% растягивать
    // нечего: дальше видно только зерно. Видео не приближаем вовсе.
    var MAX_SCALE = 1.4;
    var zoom = { scale: 1, tx: 0, ty: 0 };

    function activeMedia() {
      return player && player.style.display !== "none" ? player : stageImg;
    }

    function applyZoom() {
      var el = activeMedia();
      el.style.transform = zoom.scale === 1
        ? ""
        : "translate(" + zoom.tx + "px, " + zoom.ty + "px) scale(" + zoom.scale + ")";
      viewport.classList.toggle("zoomed", zoom.scale > 1);
      if (zoomLevelEl) zoomLevelEl.textContent = Math.round(zoom.scale * 100) + "%";
    }

    // Держит картинку в пределах окна: при увеличении её можно двигать ровно
    // настолько, насколько она выходит за границы, иначе она уезжала бы в пустоту.
    function clampPan() {
      var el = activeMedia();
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var w = el.offsetWidth * zoom.scale;
      var h = el.offsetHeight * zoom.scale;
      var baseLeft = (vw - el.offsetWidth) / 2;
      var baseTop = (vh - el.offsetHeight) / 2;
      var minTx = Math.min(0, vw - w - baseLeft);
      var maxTx = Math.max(0, -baseLeft);
      var minTy = Math.min(0, vh - h - baseTop);
      var maxTy = Math.max(0, -baseTop);
      zoom.tx = Math.max(minTx, Math.min(maxTx, zoom.tx));
      zoom.ty = Math.max(minTy, Math.min(maxTy, zoom.ty));
    }

    function resetZoom() {
      zoom.scale = 1;
      zoom.tx = 0;
      zoom.ty = 0;
      // Снимаем масштаб с обоих элементов: при переключении фото/видео
      // на скрытом иначе остался бы старый transform.
      stageImg.style.transform = "";
      if (player) player.style.transform = "";
      applyZoom();
    }

    // На видео приближение отключено: кадр и так во весь экран, а увеличение
    // мыльного видео только портит картинку.
    function zoomAllowed() {
      return !stage.classList.contains("video-mode");
    }

    // Масштабирует так, чтобы точка под курсором осталась на месте.
    function zoomAt(nextScale, clientX, clientY) {
      if (!zoomAllowed()) return;
      var el = activeMedia();
      nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      var rect = el.getBoundingClientRect();
      if (clientX === undefined) {
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
      }
      var ratio = nextScale / zoom.scale;
      zoom.tx = clientX - rect.left - (clientX - rect.left - zoom.tx) * ratio;
      zoom.ty = clientY - rect.top - (clientY - rect.top - zoom.ty) * ratio;
      zoom.scale = nextScale;
      if (zoom.scale === 1) {
        resetZoom();
        return;
      }
      clampPan();
      applyZoom();
      hideHint();
    }

    var hintTimer = null;

    function hideHint() {
      if (zoomHintEl) zoomHintEl.classList.add("hidden");
    }

    viewport.addEventListener("wheel", function (e) {
      if (!zoomAllowed()) return;
      e.preventDefault();
      zoomAt(zoom.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
    }, { passive: false });

    // Клик по фото приближает, повторный — возвращает как было.
    stageImg.addEventListener("click", function (e) {
      if (dragMoved) return;
      if (zoom.scale > 1) resetZoom();
      else zoomAt(2.5, e.clientX, e.clientY);
    });
    stageImg.addEventListener("dblclick", resetZoom);

    zoomBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-zoom");
        if (kind === "in") zoomAt(zoom.scale * 1.4);
        else if (kind === "out") zoomAt(zoom.scale / 1.4);
        else resetZoom();
      });
    });

    // Перетаскивание увеличенной картинки. Указатели, а не мышь, — чтобы
    // работало и пальцем на телефоне.
    var dragging = false;
    var dragMoved = false;
    var dragStart = null;
    var pointers = {};
    var pinchStart = null;

    viewport.addEventListener("pointerdown", function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]];
        var b = pointers[ids[1]];
        pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: zoom.scale };
        dragging = false;
        return;
      }
      if (zoom.scale <= 1) return;
      dragging = true;
      dragMoved = false;
      dragStart = { x: e.clientX - zoom.tx, y: e.clientY - zoom.ty };
      viewport.classList.add("dragging");
    });

    viewport.addEventListener("pointermove", function (e) {
      if (pointers[e.pointerId]) {
        pointers[e.pointerId].x = e.clientX;
        pointers[e.pointerId].y = e.clientY;
      }
      var ids = Object.keys(pointers);
      // Щипок двумя пальцами.
      if (pinchStart && ids.length === 2) {
        var a = pointers[ids[0]];
        var b = pointers[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart.dist > 0) {
          zoomAt(pinchStart.scale * (dist / pinchStart.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        return;
      }
      if (!dragging) return;
      zoom.tx = e.clientX - dragStart.x;
      zoom.ty = e.clientY - dragStart.y;
      if (Math.abs(zoom.tx - (e.clientX - dragStart.x)) > 0) dragMoved = true;
      dragMoved = true;
      clampPan();
      applyZoom();
    });

    function endPointer(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchStart = null;
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove("dragging");
      // Клик после перетаскивания не должен переключать масштаб.
      setTimeout(function () { dragMoved = false; }, 0);
    }
    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);

    // Видео технического состояния лежат в репозитории (/media/<id>/video/*.mp4)
    // и проигрываются прямо в лайтбоксе — плеер создаётся один раз и переиспользуется.
    var player = lightbox.querySelector(".lightbox__player");
    if (!player) {
      player = document.createElement("video");
      player.className = "lightbox__player";
      player.setAttribute("controls", "");
      player.setAttribute("playsinline", "");
      player.setAttribute("preload", "metadata");
      // Из панели проигрывателя убираем всё лишнее: скачивание ролика
      // (чтобы видео не расходилось по чужим объявлениям), скорость
      // воспроизведения, картинку-в-картинке и трансляцию на телевизор.
      // Заодно исчезает меню из трёх точек — в нём как раз эти пункты.
      player.setAttribute("controlsList", "nodownload noplaybackrate noremoteplayback nofullscreen");
      player.setAttribute("disablePictureInPicture", "");
      player.setAttribute("disableRemotePlayback", "");
      player.style.display = "none";
      stageImg.parentNode.insertBefore(player, stageImg.nextSibling);
    }

    function stopVideo() {
      resetZoom();
      stage.classList.remove("video-mode");
      if (zoomBar) zoomBar.classList.remove("hidden");
      player.onerror = null;
      player.removeAttribute("poster");
      player.pause();
      player.removeAttribute("src");
      player.load();
      player.style.display = "none";
      stageImg.style.display = "";
      prevBtn.style.display = state.photos.length > 1 ? "" : "none";
      nextBtn.style.display = state.photos.length > 1 ? "" : "none";
      counterEl.style.display = "";
      videosEl.querySelectorAll(".lightbox__video-tile").forEach(function (c) {
        c.classList.remove("playing");
      });
    }

    // Все ролики лежат на нашем же хостинге. Если файл всё же не открылся
    // (не догрузился при выкладке, оборвалась сеть) — говорим об этом прямо
    // и предлагаем позвонить, а не уводим посетителя на сторону.
    function videoUnavailable() {
      stopVideo();
      var note = videosEl.querySelector(".lightbox__videos-note");
      if (!note) {
        note = document.createElement("div");
        note.className = "lightbox__videos-note";
        videosEl.appendChild(note);
      }
      note.textContent = "Не удалось загрузить видео. Обновите страницу или позвоните нам: +7 (908) 448-11-00";
    }

    function playVideo(url, chip, poster) {
      resetZoom();
      if (poster) player.poster = poster;
      stage.classList.add("video-mode");
      if (zoomBar) zoomBar.classList.add("hidden");
      stageImg.style.display = "none";
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      counterEl.style.display = "none";
      player.style.display = "";
      player.onerror = function () {
        player.onerror = null;
        videoUnavailable();
      };
      player.src = url;
      player.play().catch(function () {});
      videosEl.querySelectorAll(".lightbox__video-tile").forEach(function (c) {
        c.classList.toggle("playing", c === chip);
      });
    }

    // Карточки показывают превью 300x400 из /media/<id>/images/thumb/, а на
    // большой сцене лайтбокса нужен оригинал 900x1200 из /media/<id>/images/ —
    // имя и расширение у оригинала те же, что у превью.
    // Внешние (нелокальные) ссылки оставляем как есть.
    function fullSrc(src) {
      if (!src || src.indexOf("/media/") !== 0) return src;
      return src.replace("/images/thumb/", "/images/");
    }

    function formatTime(seconds) {
      var m = Math.floor(seconds / 60);
      var sec = seconds % 60;
      return m + ":" + (sec < 10 ? "0" : "") + sec;
    }

    function renderStage() {
      if (!state.photos.length) return;
      if (player && player.style.display !== "none") stopVideo();
      resetZoom();
      var thumb = state.photos[state.index];
      stageImg.onerror = function () { stageImg.onerror = null; stageImg.src = thumb; };
      stageImg.src = fullSrc(thumb);
      counterEl.textContent = state.photos.length > 1 ? (state.index + 1) + " / " + state.photos.length : "";
      thumbsEl.querySelectorAll(".lightbox__thumb").forEach(function (t, i) {
        t.classList.toggle("active", i === state.index);
      });
    }

    // Ссылка на конкретный мотор прямо из окна с фото: менеджер копирует её
    // и отправляет клиенту, тот попадает сразу сюда же.
    function renderShare(motorId) {
      var box = lightbox.querySelector(".lightbox__share");
      if (!box) return;
      if (!motorId) {
        box.innerHTML = "";
        return;
      }
      // Ссылка открывает то же окно с фото и видео прямо в каталоге:
      // закрыв его, клиент остаётся в каталоге и смотрит остальные моторы.
      var link = location.origin + "/catalog.html?motor=" + encodeURIComponent(motorId);
      box.innerHTML = '<button type="button" class="lightbox__share-btn">🔗 Скопировать ссылку на мотор</button>';
      box.querySelector(".lightbox__share-btn").addEventListener("click", function () {
        var btn = this;
        var done = function () {
          btn.textContent = "✓ Ссылка скопирована";
          btn.classList.add("is-done");
          setTimeout(function () {
            btn.textContent = "🔗 Скопировать ссылку на мотор";
            btn.classList.remove("is-done");
          }, 2200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(done, function () { fallbackCopy(link, done); });
        } else {
          fallbackCopy(link, done);
        }
      });
    }

    // Запасной способ: в старых браузерах и без https clipboard недоступен.
    function fallbackCopy(text, done) {
      var field = document.createElement("textarea");
      field.value = text;
      field.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); done(); } catch (e) { prompt("Скопируйте ссылку:", text); }
      field.remove();
    }

    // Пока окно открыто, адрес показывает конкретный мотор — тогда ссылку
    // можно скопировать прямо из адресной строки, а не только кнопкой.
    //
    // В историю браузера добавляем ровно одну запись — на первое открытие.
    // Переключение между моторами адрес просто подменяет, иначе после десяти
    // просмотренных карточек пришлось бы десять раз жать «назад», чтобы уйти.
    // urlHasMotor — адрес сейчас указывает на мотор.
    // pushedEntry — запись в историю добавили мы (а не переход по ссылке).
    var urlHasMotor = false;
    var pushedEntry = false;

    function rememberMotorInUrl(motorId) {
      if (!motorId || !history.pushState) return;
      var url = location.pathname + "?motor=" + encodeURIComponent(motorId);
      if (urlHasMotor) {
        history.replaceState({ motor: motorId }, "", url);
      } else {
        history.pushState({ motor: motorId }, "", url);
        urlHasMotor = true;
        pushedEntry = true;
      }
    }

    function forgetMotorInUrl() {
      if (!urlHasMotor) return;
      urlHasMotor = false;
      if (pushedEntry) {
        // Свою запись убираем шагом назад, а не новой записью: иначе после
        // десяти открытых моторов в истории накопится десять адресов.
        pushedEntry = false;
        history.back();
      } else if (history.replaceState) {
        // Пришли по ссылке — своей записи нет, «назад» увело бы с сайта.
        history.replaceState({}, "", location.pathname);
      }
    }

    function openWith(trigger) {
      var caption = trigger.getAttribute("data-caption") || "";
      var photos = [];
      var videos = [];
      try { photos = JSON.parse(trigger.getAttribute("data-photos") || "[]"); } catch (e) {}
      try { videos = JSON.parse(trigger.getAttribute("data-videos") || "[]"); } catch (e) {}
      if (!photos.length) photos = [trigger.getAttribute("data-lightbox")];

      state.photos = photos;
      state.index = 0;
      captionEl.textContent = caption;
      var motorId = trigger.getAttribute("data-motor-id") || "";
      renderShare(motorId);
      rememberMotorInUrl(motorId);

      thumbsEl.innerHTML = photos.length > 1
        ? photos.map(function (src, i) {
            return '<button class="lightbox__thumb" data-i="' + i + '"><img src="' + src + '" alt=""></button>';
          }).join("")
        : "";
      thumbsEl.querySelectorAll(".lightbox__thumb").forEach(function (t) {
        t.addEventListener("click", function () {
          state.index = parseInt(t.getAttribute("data-i"), 10);
          renderStage();
        });
      });

      if (videos.length) {
        // Поддержка двух форматов: новые записи — объекты {label, url} (добавленные
        // через админ-панель со ссылкой на реальное видео), старые — просто строки
        // с названием, которые вели на карточку товара на сайте-источнике.
        videosEl.innerHTML =
          '<div class="lightbox__videos-title">Видео технического состояния (' + videos.length + ')</div>' +
          '<div class="lightbox__videos-list">' +
          videos.map(function (v) {
            var label = typeof v === "string" ? v : (v.label || "Видео");
            var url = (typeof v === "object" && v.url) ? v.url : "";
            var poster = (typeof v === "object" && v.poster) ? v.poster : "";
            // Обложка есть не у всех роликов: у загруженных через панель кадр
            // иногда не снимается — браузер не всегда берётся декодировать файл
            // на стороне менеджера. Тогда показываем кадр из самого ролика:
            // preload=metadata и #t=1 заставляют браузер нарисовать секунду видео,
            // не скачивая его целиком.
            var coverInner = poster
              ? '<img src="' + poster + '" alt="" loading="lazy">'
              : (url ? '<video class="lightbox__video-frame" src="' + url + '#t=1"' +
                       ' preload="metadata" muted playsinline></video>' : "");
            var cover =
              '<span class="lightbox__video-cover' + (poster || url ? "" : " lightbox__video-cover--empty") + '">' +
                coverInner +
                '<span class="lightbox__video-play">▶</span>' +
                (typeof v === "object" && v.duration ? '<span class="lightbox__video-time">' + formatTime(v.duration) + "</span>" : "") +
              "</span>" +
              '<span class="lightbox__video-name">' + label + "</span>";
            // Свой файл — играем прямо здесь; внешняя ссылка (или её отсутствие) —
            // как и раньше, уводим на карточку мотора на сайте-источнике.
            if (!url) return "";
            return '<button type="button" class="lightbox__video-tile" data-video="' + url + '"' +
              (poster ? ' data-poster="' + poster + '"' : "") + ">" + cover + "</button>";
          }).join("") +
          "</div>" +
          "";
        videosEl.querySelectorAll("[data-video]").forEach(function (tile) {
          tile.addEventListener("click", function () {
            playVideo(tile.getAttribute("data-video"), tile, tile.getAttribute("data-poster"));
          });
        });
      } else {
        videosEl.innerHTML = "";
      }

      prevBtn.style.display = photos.length > 1 ? "" : "none";
      nextBtn.style.display = photos.length > 1 ? "" : "none";

      if (lightboxBox && lightboxBox.classList.contains("panel-hidden")) {
        lightboxBox.classList.remove("panel-hidden");
      }
      renderStage();
      if (zoomHintEl) {
        zoomHintEl.classList.remove("hidden");
        clearTimeout(hintTimer);
        hintTimer = setTimeout(hideHint, 4000);
      }
      lightbox.classList.add("open");
    }

    // Ссылка с мотором: открываем его окно сразу, без лишних нажатий.
    function openFromUrl() {
      var wanted = new URLSearchParams(location.search).get("motor");
      if (!wanted) return;
      var tries = 0;
      // Карточки каталога появляются после загрузки данных — ждём их.
      var timer = setInterval(function () {
        var trigger = document.querySelector('[data-motor-id="' + wanted + '"]');
        if (trigger) {
          clearInterval(timer);
          // Человек пришёл по ссылке: адрес уже правильный, и «назад» должно
          // вести туда, откуда он пришёл, а не закрывать окно на месте.
          urlHasMotor = true;
          pushedEntry = false;
          openWith(trigger);
          var card = trigger.closest(".motor-card");
          if (card) card.scrollIntoView({ block: "center" });
        } else if (++tries > 40) {
          clearInterval(timer);
        }
      }, 150);
    }
    openFromUrl();

    // Кнопка «назад» (и жест смахивания на телефоне) закрывает окно и
    // оставляет человека в каталоге — раньше она уводила с сайта целиком.
    window.addEventListener("popstate", function () {
      if (lightbox.classList.contains("open")) {
        // Шаг назад сделал сам человек — окно закрываем, историю не трогаем.
        urlHasMotor = false;
        pushedEntry = false;
        stopVideo();
        lightbox.classList.remove("open");
      }
    });

    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-lightbox]");
      if (!trigger) {
        // По карточке мотора в каталоге можно нажать где угодно — на название,
        // на цену, на пустое место. Исключение — таблица характеристик:
        // её читают, а не нажимают, и случайное открытие окна там мешает.
        // Ссылки и кнопки внутри карточки тоже работают по-своему.
        var card = e.target.closest(".motor-card");
        if (card && !e.target.closest(".spec-list, a, button")) {
          trigger = card.querySelector("[data-lightbox]");
        }
      }
      if (trigger) openWith(trigger);
    });
    // Закрытие лайтбокса всегда глушит видео — иначе ролик продолжает играть за кадром.
    function closeLightbox() {
      stopVideo();
      lightbox.classList.remove("open");
      forgetMotorInUrl();
    }
    closeBtn.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    prevBtn.addEventListener("click", function () {
      if (!state.photos.length) return;
      state.index = (state.index - 1 + state.photos.length) % state.photos.length;
      renderStage();
    });
    nextBtn.addEventListener("click", function () {
      if (!state.photos.length) return;
      state.index = (state.index + 1) % state.photos.length;
      renderStage();
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevBtn.click();
      if (e.key === "ArrowRight") nextBtn.click();
      if (e.key === "+" || e.key === "=") zoomAt(zoom.scale * 1.4);
      if (e.key === "-" || e.key === "_") zoomAt(zoom.scale / 1.4);
      if (e.key === "0") resetZoom();
    });
  }

  /* ---------- Подсветка активного пункта меню ---------- */
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav.main-nav a, .mobile-nav__panel a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === here) a.classList.add("active");
  });
});
