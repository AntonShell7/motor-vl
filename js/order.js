// ===== МОТОР-ВЛ: логика страницы "Оставить заявку" =====

document.addEventListener("DOMContentLoaded", function () {
  var params = new URLSearchParams(location.search);
  var messageField = document.getElementById("fieldMessage");

  // Если пришли из каталога по конкретному мотору или за подбором из Японии —
  // подставляем это в комментарий: отдельного поля под модель больше нет.
  var motorFromUrl = params.get("motor");
  if (messageField && !messageField.value) {
    if (motorFromUrl) messageField.value = "Интересует: " + motorFromUrl;
    else if (params.get("type") === "japan") messageField.value = "Подбор под заказ из Японии";
  }

  // ---------- Подбор мотора ----------
  // Ряд мощностей подвесных моторов не непрерывный: бывает 30 и 40, но не 32 и не 35.
  // Это объединённый ряд четырёх марок из каталога (Yamaha F, Honda BF, Suzuki DF,
  // Tohatsu/Mercury) — стрелки и поля ходят строго по нему, промежуточных значений нет.
  var HP_STEPS = [
    2, 2.3, 2.5, 3.5, 4, 5, 6, 8, 9.8, 9.9, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80,
    90, 100, 115, 130, 135, 140, 150, 175, 200, 225, 250, 300, 350
  ];

  var picker = document.getElementById("motorPicker");
  var powerInput = document.getElementById("powerValue");

  function formatHp(value) {
    return String(value).replace(".", ",");
  }

  function parseHp(text) {
    var value = parseFloat(String(text).replace(",", "."));
    return isNaN(value) ? null : value;
  }

  // Ближайшее допустимое значение — чтобы после ручного ввода «32» осталось 30.
  function snap(value) {
    return HP_STEPS.reduce(function (best, step) {
      return Math.abs(step - value) < Math.abs(best - value) ? step : best;
    }, HP_STEPS[0]);
  }

  function stepHp(input, direction) {
    var current = parseHp(input.value);
    var index;
    if (current === null) {
      // Пустое поле: «+» начинает с самого маленького мотора, «−» — с самого большого.
      index = direction > 0 ? 0 : HP_STEPS.length - 1;
    } else {
      var snapped = snap(current);
      index = HP_STEPS.indexOf(snapped) + direction;
      if (index < 0) index = 0;
      if (index > HP_STEPS.length - 1) index = HP_STEPS.length - 1;
    }
    input.value = formatHp(HP_STEPS[index]);
  }

  if (picker) {
    picker.querySelectorAll(".power-step__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-target"));
        stepHp(input, btn.getAttribute("data-step") === "up" ? 1 : -1);
      });
    });

    if (powerInput) {
      powerInput.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        stepHp(powerInput, e.key === "ArrowUp" ? 1 : -1);
      });
      // Пока печатают — не мешаем; подгоняем к ближайшей реальной мощности по выходу.
      powerInput.addEventListener("blur", function () {
        var value = parseHp(powerInput.value);
        powerInput.value = value === null ? "" : formatHp(snap(value));
      });
    }
  }

  function powerText() {
    var value = powerInput && powerInput.value.trim();
    return value ? value + " л.с." : "";
  }

  // Собирает выбор в объект вида {Бренд: ["Yamaha"], Мощность: "30–60 л.с."}.
  function collectSpec() {
    var spec = {};
    if (!picker) return spec;
    picker.querySelectorAll(".pick").forEach(function (group) {
      var label = group.getAttribute("data-label");
      if (group.getAttribute("data-key") === "power") {
        var text = powerText();
        if (text) spec[label] = text;
        return;
      }
      var values = [];
      group.querySelectorAll('input[type="checkbox"]:checked').forEach(function (input) {
        values.push(input.value);
      });
      if (values.length) spec[label] = values;
    });
    return spec;
  }

  // Одна строка для менеджера: «Бренд: Yamaha, Honda · Мощность: 30–60 л.с.»
  function specToLine(spec) {
    return Object.keys(spec).map(function (key) {
      var value = spec[key];
      return key + ": " + (Array.isArray(value) ? value.join(", ") : value);
    }).join(" · ");
  }

  var form = document.getElementById("orderForm");
  var successBlock = document.getElementById("orderSuccess");
  var errorBlock = document.getElementById("orderError");

  // Красивое форматирование номера телефона при вводе: (908) 448-11-00
  var phoneInput = document.getElementById("fieldPhone");
  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      var digits = phoneInput.value.replace(/\D/g, "").slice(0, 10);
      var formatted = "";
      if (digits.length > 0) formatted += "(" + digits.slice(0, 3);
      if (digits.length >= 3) formatted += ") ";
      if (digits.length > 3) formatted += digits.slice(3, 6);
      if (digits.length >= 6) formatted += "-";
      if (digits.length > 6) formatted += digits.slice(6, 8);
      if (digits.length >= 8) formatted += "-";
      if (digits.length > 8) formatted += digits.slice(8, 10);
      phoneInput.value = formatted;
    });
  }

  // Красивое сообщение вместо стандартного "Установите флажок здесь"
  var consentInput = document.getElementById("fieldConsent");
  if (consentInput) {
    consentInput.addEventListener("invalid", function () {
      consentInput.setCustomValidity("Пожалуйста, подтвердите согласие на обработку персональных данных");
    });
    consentInput.addEventListener("change", function () {
      consentInput.setCustomValidity("");
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправляем…";
      if (errorBlock) errorBlock.style.display = "none";

      var phoneCodeEl = document.getElementById("fieldPhoneCode");
      var phoneCode = phoneCodeEl ? phoneCodeEl.value : "+7";
      var phoneNumber = document.getElementById("fieldPhone").value.trim();
      var fullPhone = phoneNumber ? (phoneCode + " " + phoneNumber) : "";

      var spec = collectSpec();
      // Мессенджеры — это способ связи, а не параметр мотора: их блок стоит рядом
      // с телефоном, выше блока подбора, поэтому собираем отдельно.
      var messengers = [];
      document.querySelectorAll('[data-key="messenger"] input[type="checkbox"]:checked')
        .forEach(function (input) { messengers.push(input.value); });

      var trap = document.getElementById("fieldWebsite");

      // Вместе с заявкой сохраняем, какой именно текст согласия видел человек.
      // Если когда-нибудь спросят, чем подтверждается согласие, ответ будет
      // не «где-то на сайте написано», а точная формулировка и время.
      var consentEl = document.getElementById("consentNote");
      var consentText = consentEl ? consentEl.textContent.replace(/\s+/g, " ").trim() : "";

      var payload = {
        action: "submit",
        consent: consentText,
        // Поле-ловушка: у человека оно всегда пустое.
        website: trap ? trap.value : "",
        name: document.getElementById("fieldName").value,
        phone: fullPhone,
        messengers: messengers,
        // В motor кладём готовую строку — она сразу видна менеджеру в списке заявок,
        // а spec уходит рядом, чтобы позже можно было фильтровать заявки по параметрам.
        motor: specToLine(spec),
        spec: spec,
        message: document.getElementById("fieldMessage").value
      };

      fetch("/api/leads.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("bad status");
          form.style.display = "none";
          if (successBlock) successBlock.classList.add("show");
          window.scrollTo({ top: form.offsetTop - 140, behavior: "smooth" });
        })
        .catch(function () {
          if (errorBlock) errorBlock.style.display = "block";
          submitBtn.disabled = false;
          submitBtn.textContent = "Отправить заявку";
        });
    });
  }
});
