<?php
// Проверка настроек на хостинге. Локально PHP запустить негде, поэтому эта
// страница отвечает на вопрос «всё ли готово» прямо на сервере.
//
// Открывать так (пароль — тот же, что у панели):
//     https://ваш-домен/api/selftest.php?password=ВАШ_ПАРОЛЬ
//
// Пароль обязателен: иначе страница рассказывала бы посторонним, как устроен сайт.

declare(strict_types=1);

require __DIR__ . '/lib.php';

// Пароль принимаем заголовком — так панель может вызвать проверку сама,
// не подставляя пароль в адрес (он попадает в логи и историю браузера).
// Ручной способ ?password=... оставлен: им пользуются с телефона.
require_admin(admin_password_header() ?? ($_GET['password'] ?? null));

$checks = [];

$checks[] = ['PHP версии ' . PHP_VERSION, version_compare(PHP_VERSION, '8.0', '>='),
    'нужен PHP 8.0 или новее — версия переключается в панели хостинга'];

$checks[] = ['Файл настроек api/config.local.php', is_file(__DIR__ . '/config.local.php'),
    'скопируйте api/config.example.php в api/config.local.php и заполните'];

$checks[] = ['Каталог data/motors.json доступен для записи',
    is_writable(DATA_DIR) && (!is_file(DATA_DIR . '/motors.json') || is_writable(DATA_DIR . '/motors.json')),
    'дайте папке data права 755, а файлу motors.json — 644'];

// Переполненный диск ломает всё сразу: и сохранение мотора, и отметку заявки,
// и счётчик посещений — причём с виду это выглядит как «просто не работает».
$freeBytes = @disk_free_space(ROOT_DIR);
$freeMb = $freeBytes === false ? 0 : (int) round($freeBytes / 1048576);
$checks[] = ['Свободное место на диске: ' . ($freeBytes === false ? 'неизвестно' : $freeMb . ' МБ'),
    $freeBytes === false || $freeMb > 50,
    'места почти нет — сервер не может сохранить ни мотор, ни заявку. '
    . 'Удалите старые видео или увеличьте тариф хостинга'];

$checks[] = ['Папка private/ существует и доступна для записи',
    is_dir(PRIVATE_DIR) && is_writable(PRIVATE_DIR),
    'создайте папку private рядом с index.html и дайте ей права 755'];

$checks[] = ['Папка media/ доступна для записи (загрузка фото)',
    is_writable(ROOT_DIR . '/media'),
    'дайте папке media права 755'];

$maxUpload = ini_get('upload_max_filesize');
$checks[] = ['Загрузка видео: предел файла ' . $maxUpload,
    (int) $maxUpload >= 50,
    'ролики весят десятки мегабайт; если предел меньше — поднимите upload_max_filesize '
    . 'в панели хостинга (PHP-настройки)'];

$checks[] = ['Папка media/motors доступна для записи',
    is_writable(ROOT_DIR . '/media') && (!is_dir(ROOT_DIR . '/media/motors') || is_writable(ROOT_DIR . '/media/motors')),
    'дайте папке media права 755 — иначе панель не сможет сохранять фото и видео'];

$checks[] = ['Токен Telegram заполнен', config_value('telegram_token') !== '',
    'без него заявки будут только в панели, без уведомлений в чат'];

$checks[] = ['id чата Telegram заполнен', config_value('telegram_chat_id') !== '',
    'узнать id: python3 tools/telegram_chat_id.py'];

$checks[] = ['Есть curl для запросов к Telegram', function_exists('curl_init'),
    'не критично — есть запасной путь через file_get_contents'];

$checks[] = ['Разрешены внешние запросы (allow_url_fopen)', (bool) ini_get('allow_url_fopen'),
    'не критично, если работает curl'];

// Живая проверка связи с ботом: getMe ничего не отправляет в чат.
$botName = null;
$token = config_value('telegram_token');
if ($token !== '' && function_exists('curl_init')) {
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/getMe');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $response = curl_exec($ch);
    curl_close($ch);
    $data = is_string($response) ? json_decode($response, true) : null;
    if (is_array($data) && !empty($data['ok'])) {
        $botName = $data['result']['username'] ?? 'бот';
    }
    $checks[] = ['Бот отвечает' . ($botName ? ' (@' . $botName . ')' : ''), $botName !== null,
        'проверьте токен — Telegram его не принял'];
}

// Самое важное: убедиться, что папку с заявками нельзя открыть из браузера.
// Полагаться на .htaccess вслепую нельзя — на nginx он просто не читается.
if (function_exists('curl_init')) {
    $scheme = (($_SERVER['HTTPS'] ?? '') === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $probe = $scheme . '://' . $host . '/private/leads.json';
    $ch = curl_init($probe);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false]);
    curl_exec($ch);
    $probeCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $checks[] = ['Заявки закрыты от посторонних (' . $probe . ' отдаёт ' . $probeCode . ')',
        $probeCode !== 200,
        'СРОЧНО: файл с телефонами клиентов открыт всему интернету. Если хостинг на nginx, '
        . 'закройте папку private в панели хостинга или перенесите её выше корня сайта'];
}

// Панель просит JSON и показывает проверки у себя; человек, открывший
// адрес вручную, по-прежнему получает обычную страницу.
if (($_GET['format'] ?? '') === 'json') {
    $out = [];
    foreach ($checks as $check) {
        $out[] = ['name' => $check[0], 'ok' => (bool) $check[1], 'hint' => $check[2]];
    }
    json_out(200, ['checks' => $out]);
}

header('Content-Type: text/html; charset=utf-8');
$failed = 0;
echo '<!doctype html><meta charset="utf-8"><title>Проверка настроек</title>';
echo '<style>body{font:16px/1.6 -apple-system,system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px}'
   . 'li{margin-bottom:10px}small{color:#666;display:block}h1{font-size:22px}</style>';
echo '<h1>Проверка настроек сайта</h1><ul>';
foreach ($checks as [$title, $ok, $hint]) {
    if (!$ok) {
        $failed++;
    }
    echo '<li>' . ($ok ? '✅' : '❌') . ' ' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    if (!$ok) {
        echo '<small>' . htmlspecialchars($hint, ENT_QUOTES, 'UTF-8') . '</small>';
    }
    echo '</li>';
}
echo '</ul>';
echo $failed === 0
    ? '<p><b>Всё готово.</b> Оставьте тестовую заявку на сайте — она должна прийти в чат менеджеров.</p>'
    : '<p><b>Осталось исправить пунктов: ' . $failed . '.</b> Подсказки под каждым.</p>';
