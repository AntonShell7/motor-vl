<?php
// Приём видеофайла из панели управления.
//
// Ролики весят десятки мегабайт, поэтому они НЕ идут вместе с остальной формой
// в JSON: браузер отправляет файл отдельным запросом (multipart), как это делают
// обычные формы загрузки. Иначе base64 раздул бы запрос на треть, и хостинг
// отказался бы его принимать.
//
// Обложку кадром из ролика делает браузер и присылает сюда картинкой —
// на общем хостинге нет ffmpeg, а без обложки плитка видео выглядит пустой.

declare(strict_types=1);

require __DIR__ . '/lib.php';

const VIDEO_SUBDIR = 'media/motors';
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function fail(int $code, string $message): void
{
    json_out($code, ['error' => $message]);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fail(405, 'Метод не поддерживается');
}

// Хостинг с некоторого момента отбивает запросы вида multipart/form-data
// (обычная форма с файлом) ошибкой 403 — ещё до запуска PHP. Поэтому ролик
// теперь приходит сырым телом запроса, кусками, а пароль — заголовком.
// Старый способ оставлен на случай, если блокировку снимут.
require_admin($_POST['password'] ?? admin_password_header());

$mode = (string) ($_GET['mode'] ?? '');
$motorId = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($_POST['motorId'] ?? ($_GET['motorId'] ?? ''))) ?: '';
if ($motorId === '') {
    fail(400, 'Не указан мотор');
}

// Папки под ролики и обложки нужны обоим способам загрузки.
function video_dirs(string $motorId): array
{
    $dir = ROOT_DIR . '/' . VIDEO_SUBDIR . '/' . $motorId . '/video';
    $posterDir = $dir . '/poster';
    foreach ([$dir, $posterDir] as $needed) {
        if (!is_dir($needed) && !mkdir($needed, 0755, true) && !is_dir($needed)) {
            fail(500, 'Не удалось создать папку для видео — проверьте права на media/');
        }
    }
    return [$dir, $posterDir];
}

// ---------- Приём ролика кусками ----------
if ($mode === 'chunk') {
    $token = preg_replace('/[^A-Za-z0-9]/', '', (string) ($_GET['upload'] ?? ''));
    if (strlen($token) < 8) {
        fail(400, 'Не указан номер загрузки');
    }
    [$dir, $posterDir] = video_dirs($motorId);
    $partPath = $dir . '/.upload-' . $token . '.part';

    // Первый кусок начинает файл заново, остальные дописываются в конец.
    $first = ($_GET['part'] ?? '0') === '0';
    $handle = fopen($partPath, $first ? 'wb' : 'ab');
    if ($handle === false) {
        fail(500, 'Не удалось открыть файл для записи.' . free_space_hint($dir));
    }
    $input = fopen('php://input', 'rb');
    $written = $input === false ? false : stream_copy_to_stream($input, $handle);
    if ($input !== false) {
        fclose($input);
    }
    fclose($handle);
    if ($written === false) {
        @unlink($partPath);
        fail(500, 'Не удалось записать кусок ролика.' . free_space_hint($dir));
    }

    $total = (int) @filesize($partPath);
    if ($total > MAX_VIDEO_BYTES) {
        @unlink($partPath);
        fail(400, 'Ролик больше 200 МБ — сожмите его перед загрузкой');
    }

    // Кусок не последний — просто подтверждаем приём.
    if (($_GET['last'] ?? '') !== '1') {
        json_out(200, ['ok' => true, 'received' => $total]);
    }

    // Последний кусок: проверяем, что собрался настоящий видеофайл.
    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = (string) finfo_file($finfo, $partPath);
        finfo_close($finfo);
    }
    if ($mime !== '' && !str_starts_with($mime, 'video/')) {
        @unlink($partPath);
        fail(400, 'Это не видеофайл (' . $mime . ')');
    }

    $name = 'v' . date('Ymd') . '_' . bin2hex(random_bytes(4));
    if (!rename($partPath, $dir . '/' . $name . '.mp4')) {
        @unlink($partPath);
        fail(500, 'Не удалось сохранить видео на сервере.' . free_space_hint($dir));
    }

    // Обрывки прошлых загрузок не должны копиться на диске.
    foreach (glob($dir . '/.upload-*.part') ?: [] as $stale) {
        if (@filemtime($stale) < time() - 86400) {
            @unlink($stale);
        }
    }

    json_out(200, [
        'ok' => true,
        'url' => '/' . VIDEO_SUBDIR . '/' . $motorId . '/video/' . $name . '.mp4',
        'poster' => '',
        'size' => $total,
    ]);
}

// Обложку можно прислать отдельно: браузер не всегда успевает снять кадр
// до отправки файла (например, MOV декодируется только после загрузки).
if (($_POST['action'] ?? '') === 'poster' || $mode === 'poster') {
    $body = [];
    if ($mode === 'poster') {
        $body = read_json_body();
        $motorId = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($body['motorId'] ?? $motorId)) ?: $motorId;
    }
    $name = preg_replace('/[^A-Za-z0-9_.-]/', '', (string) ($_POST['name'] ?? ($body['name'] ?? '')));
    $name = pathinfo($name, PATHINFO_FILENAME);
    if ($name === '') {
        fail(400, 'Не указан ролик');
    }
    $posterDir = ROOT_DIR . '/' . VIDEO_SUBDIR . '/' . $motorId . '/video/poster';
    if (!is_dir($posterDir) && !mkdir($posterDir, 0755, true) && !is_dir($posterDir)) {
        fail(500, 'Не удалось создать папку для обложек');
    }
    $data = (string) ($_POST['poster'] ?? ($body['poster'] ?? ''));
    if (str_contains($data, ',')) {
        $data = substr($data, strpos($data, ',') + 1);
    }
    $binary = base64_decode($data, true);
    if ($binary === false || !@getimagesizefromstring($binary)) {
        fail(400, 'Обложка не распознана');
    }
    if (file_put_contents($posterDir . '/' . $name . '.jpg', $binary) === false) {
        fail(500, 'Не удалось сохранить обложку');
    }
    json_out(200, ['poster' => '/' . VIDEO_SUBDIR . '/' . $motorId . '/video/poster/' . $name . '.jpg']);
}

$file = $_FILES['video'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    // Самая частая причина — файл больше, чем разрешает хостинг.
    $code = is_array($file) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
    $hint = in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
        ? 'Файл слишком большой для хостинга (предел ' . ini_get('upload_max_filesize') . ')'
        : 'Файл не загрузился (код ' . $code . ')';
    fail(400, $hint);
}

if ($file['size'] > MAX_VIDEO_BYTES) {
    fail(400, 'Ролик больше 200 МБ — сожмите его перед загрузкой');
}

// Проверяем, что это действительно видео, а не переименованный файл.
$mime = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = (string) finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
}
if ($mime !== '' && !str_starts_with($mime, 'video/')) {
    fail(400, 'Это не видеофайл (' . $mime . ')');
}

$dir = ROOT_DIR . '/' . VIDEO_SUBDIR . '/' . $motorId . '/video';
$posterDir = $dir . '/poster';
foreach ([$dir, $posterDir] as $needed) {
    if (!is_dir($needed) && !mkdir($needed, 0755, true) && !is_dir($needed)) {
        fail(500, 'Не удалось создать папку для видео — проверьте права на media/');
    }
}

// Имя делаем своё: в исходном могут быть пробелы, кириллица и что угодно ещё.
$name = 'v' . date('Ymd') . '_' . bin2hex(random_bytes(4));
$videoPath = $dir . '/' . $name . '.mp4';
if (!move_uploaded_file($file['tmp_name'], $videoPath)) {
    fail(500, 'Не удалось сохранить видео на сервере');
}

$posterUrl = '';
$posterData = (string) ($_POST['poster'] ?? '');
if ($posterData !== '') {
    if (str_contains($posterData, ',')) {
        $posterData = substr($posterData, strpos($posterData, ',') + 1);
    }
    $binary = base64_decode($posterData, true);
    if ($binary !== false && @getimagesizefromstring($binary)) {
        if (file_put_contents($posterDir . '/' . $name . '.jpg', $binary) !== false) {
            $posterUrl = '/' . VIDEO_SUBDIR . '/' . $motorId . '/video/poster/' . $name . '.jpg';
        }
    }
}

json_out(200, [
    'ok' => true,
    'url' => '/' . VIDEO_SUBDIR . '/' . $motorId . '/video/' . $name . '.mp4',
    'poster' => $posterUrl,
    'size' => $file['size'],
]);
