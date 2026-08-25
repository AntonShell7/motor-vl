<?php
// Личная страница мотора: motor-vl.ru/motor/1089388
//
// Нужна ради ссылок. Раньше отправить клиенту конкретный мотор было нельзя —
// только каталог целиком. Теперь у каждого свой адрес, а в мессенджерах
// такая ссылка разворачивается в карточку с фотографией, названием и ценой.

declare(strict_types=1);

require __DIR__ . '/api/lib.php';
require __DIR__ . '/api/lib_page.php';

const SITE = 'https://motor-vl.ru';

$motors = load_json_file(DATA_DIR . '/motors.json');
$wanted = trim((string) ($_GET['id'] ?? ''));

$motor = null;
foreach ($motors as $item) {
    // Ссылку можно дать и по внутреннему id, и по номеру мотора из названия —
    // менеджеру проще скопировать номер, который он и так называет клиенту.
    if ((string) ($item['id'] ?? '') === $wanted) {
        $motor = $item;
        break;
    }
    if ($wanted !== '' && preg_match('/\((\d{5,})\)/', (string) ($item['title'] ?? ''), $m) && $m[1] === $wanted) {
        $motor = $item;
        break;
    }
}

if ($motor === null) {
    http_response_code(404);
    header('Location: /404.html', true, 302);
    exit;
}

[$header, $footer, $cssHref, $jsSrc] = page_parts(__DIR__ . '/catalog.html');

$title = (string) ($motor['title'] ?? 'Лодочный мотор');
$price = (int) ($motor['price'] ?? 0);
$priceText = number_format($price, 0, ',', ' ') . ' ₽';
$photos = array_values(array_filter((array) ($motor['photos'] ?? []), 'is_string'));
if (!$photos && !empty($motor['img'])) {
    $photos = [(string) $motor['img']];
}
$main = (string) ($motor['img'] ?? ($photos[0] ?? ''));
$videos = array_values(array_filter((array) ($motor['videos'] ?? []), 'is_array'));
$specs = array_values(array_filter((array) ($motor['specs'] ?? []), static fn($s): bool => is_array($s) && !empty($s[1])));

// Описание для поиска и мессенджеров: цена и главные характеристики.
$parts = [];
foreach ($specs as [$key, $value]) {
    if (in_array($key, ['Год', 'Состояние', 'Наработка', 'Длина ноги', 'Управление'], true)) {
        $parts[] = mb_strtolower($key) . ' — ' . $value;
    }
}
$description = $title . '. Цена ' . $priceText . '. ' . implode(', ', array_slice($parts, 0, 4))
    . '. Реальные фото и видео технического состояния. Владивосток.';

$esc = static fn($v): string => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$photosJson = $esc(json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
$videosJson = $esc(json_encode($videos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
$canonical = SITE . '/motor/' . rawurlencode((string) ($motor['id'] ?? ''));
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= $esc($title) ?> — <?= $esc($priceText) ?> | МОТОР-ВЛ</title>
<meta name="description" content="<?= $esc($description) ?>">
<link rel="canonical" href="<?= $esc($canonical) ?>">
<meta property="og:type" content="product">
<meta property="og:site_name" content="МОТОР-ВЛ">
<meta property="og:title" content="<?= $esc($title . ' — ' . $priceText) ?>">
<meta property="og:description" content="<?= $esc($description) ?>">
<meta property="og:image" content="<?= $esc(SITE . $main) ?>">
<meta property="og:url" content="<?= $esc($canonical) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/<?= $esc($cssHref) ?>">
<link rel="icon" href="/images/favicon/favicon-32.png" sizes="32x32">
<link rel="icon" href="/images/favicon/favicon-16.png" sizes="16x16">
<link rel="apple-touch-icon" href="/images/favicon/apple-touch-icon.png">
<meta name="theme-color" content="#051426">
</head>
<body>

<?= $header ?>

<section class="section section--tight">
  <div class="container">
    <div class="breadcrumbs"><a href="/">Главная</a> / <a href="/catalog.html">Каталог</a> / <?= $esc($title) ?></div>

    <div class="motor-page">
      <div class="motor-page__media">
        <img class="motor-page__photo" src="<?= $esc($main) ?>" alt="<?= $esc($title) ?>"
             data-lightbox="<?= $esc($main) ?>" data-caption="<?= $esc($title) ?>"
             data-motor-id="<?= $esc($motor['id'] ?? '') ?>"
             data-photos='<?= $photosJson ?>' data-videos='<?= $videosJson ?>'>
        <div class="motor-page__hint">Нажмите на фото — откроются все снимки и видео</div>
      </div>

      <div class="motor-page__info">
        <h1 class="motor-page__title"><?= $esc($title) ?></h1>
        <div class="motor-page__price"><?= $esc($priceText) ?></div>

        <?php if ($specs): ?>
        <div class="spec-list">
          <?php foreach ($specs as [$key, $value]): ?>
          <div class="spec-row"><em><?= $esc($key) ?></em><b><?= $esc($value) ?></b></div>
          <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <div class="motor-page__actions">
          <a class="btn btn--accent btn--lg" href="/order.html?motor=<?= rawurlencode($title) ?>">Оставить заявку</a>
          <a class="btn btn--navy btn--lg" href="tel:+79084481100">Позвонить</a>
        </div>

        <?php if ($videos): ?>
        <p class="motor-page__videos-note">🎬 Видео технического состояния: <?= count($videos) ?> —
          смотрите в окне с фотографиями</p>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>

<?= $footer ?>

<script src="/<?= $esc($jsSrc) ?>"></script>
<script>
  // Клиент пришёл по ссылке от менеджера — показываем фото и видео сразу,
  // без лишнего нажатия. Закрыл окно — попал в каталог, а не в тупик.
  (function () {
    var box = document.querySelector(".lightbox");
    var photo = document.querySelector(".motor-page__photo");
    if (!box || !photo) return;
    box.setAttribute("data-close-to", "/catalog.html");
    setTimeout(function () { photo.click(); }, 100);
  })();
</script>
</body>
</html>
