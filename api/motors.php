<?php
// Каталог моторов для панели /admin.
//
// В отличие от прежней схемы, файл data/motors.json лежит здесь же на хостинге
// и правится напрямую. GitHub-токен больше не нужен: сохранение — это запись
// файла, а не коммит в репозиторий.
//
// Фотографии из админки складываются в media/motors/<id>/.

declare(strict_types=1);

require __DIR__ . '/lib.php';

const MOTORS_FILE = DATA_DIR . '/motors.json';
// Каталог правится только через панель, и любая ошибка — своя или чужая —
// раньше стирала его без следа. Теперь перед каждой записью прячем копию
// в закрытую папку: последние 30 версий с датой в имени.
const BACKUP_DIR = PRIVATE_DIR . '/catalog-backups';
// Проданные моторы не удаляются, а переезжают сюда: карточку можно вернуть
// в каталог, если сняли по ошибке, и по этому же файлу считается статистика
// продаж. Фотографии при этом остаются на диске.
const SOLD_FILE = PRIVATE_DIR . '/sold.json';
const BACKUP_KEEP = 30;
const MEDIA_SUBDIR = 'media/motors';

const BRAND_LABELS = [
    'yamaha' => 'Yamaha',
    'honda' => 'Honda',
    'suzuki' => 'Suzuki',
    'tohatsu' => 'Tohatsu / Mercury',
    'parts' => 'Запчасти',
];

// Разрешаем только настоящие картинки: расширение из белого списка плюс
// проверка, что файл действительно изображение, а не переименованный скрипт.
const ALLOWED_EXT = ['jpg' => 'jpg', 'jpeg' => 'jpg', 'png' => 'png', 'webp' => 'webp'];

function decode_photo(string $base64): ?string
{
    // Из браузера может прийти как «data:image/jpeg;base64,...», так и чистая база.
    if (str_contains($base64, ',')) {
        $base64 = substr($base64, strpos($base64, ',') + 1);
    }
    $binary = base64_decode($base64, true);
    return $binary === false ? null : $binary;
}

function looks_like_image(string $binary): bool
{
    $info = @getimagesizefromstring($binary);
    return is_array($info) && !empty($info[0]);
}

function store_photo(string $motorId, string $filename, string $base64, int $seq): ?string
{
    $binary = decode_photo($base64);
    if ($binary === null || !looks_like_image($binary)) {
        return null;
    }
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $ext = ALLOWED_EXT[$ext] ?? 'jpg';

    $safeId = preg_replace('/[^A-Za-z0-9_-]/', '', $motorId) ?: 'motor';
    $dir = ROOT_DIR . '/' . MEDIA_SUBDIR . '/' . $safeId;
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        return null;
    }
    $name = 'photo' . $seq . '.' . $ext;
    if (file_put_contents($dir . '/' . $name, $binary) === false) {
        return null;
    }
    return '/' . MEDIA_SUBDIR . '/' . $safeId . '/' . $name;
}

function delete_photos(string $motorId): void
{
    $safeId = preg_replace('/[^A-Za-z0-9_-]/', '', $motorId) ?: '';
    if ($safeId === '') {
        return;
    }
    $dir = ROOT_DIR . '/' . MEDIA_SUBDIR . '/' . $safeId;
    if (!is_dir($dir)) {
        return;
    }
    foreach (glob($dir . '/*') ?: [] as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    @rmdir($dir);
}

// Возвращает false, только если каталога ещё нет — тогда и прятать нечего.
function backup_catalog(): bool
{
    if (!is_file(MOTORS_FILE)) {
        return false;
    }
    if (!is_dir(BACKUP_DIR) && !mkdir(BACKUP_DIR, 0755, true) && !is_dir(BACKUP_DIR)) {
        return false;
    }
    $name = BACKUP_DIR . '/motors-' . gmdate('Y-m-d_His') . '.json';
    @copy(MOTORS_FILE, $name);

    // Старые копии подчищаем, чтобы папка не росла бесконечно.
    $files = glob(BACKUP_DIR . '/motors-*.json') ?: [];
    sort($files);
    foreach (array_slice($files, 0, max(0, count($files) - BACKUP_KEEP)) as $old) {
        @unlink($old);
    }
    return true;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    require_admin($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? null);
    json_out(200, ['motors' => load_json_file(MOTORS_FILE)]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Метод не поддерживается']);
}

$payload = read_json_body();
require_admin($payload['password'] ?? null);

$motors = load_json_file(MOTORS_FILE);
$action = (string) ($payload['action'] ?? '');

// Снять с продажи: мотор уходит в архив, фотографии остаются на месте.
if ($action === 'delete' || $action === 'sell') {
    $id = (string) ($payload['id'] ?? '');
    $motor = null;
    foreach ($motors as $item) {
        if (($item['id'] ?? '') === $id) {
            $motor = $item;
            break;
        }
    }
    if ($motor === null) {
        json_out(404, ['error' => 'Мотор не найден']);
    }
    $motors = array_values(array_filter($motors, static fn($m): bool => ($m['id'] ?? '') !== $id));

    $sold = load_json_file(SOLD_FILE);
    $motor['soldAt'] = gmdate('c');
    // Цена на момент снятия — потом её могут поменять, а для статистики
    // важно то, за сколько мотор стоял в каталоге.
    $motor['soldPrice'] = (int) ($motor['price'] ?? 0);
    array_unshift($sold, $motor);
    save_json_file(SOLD_FILE, $sold);

    backup_catalog();
    if (!save_json_file(MOTORS_FILE, $motors)) {
        json_out(500, ['error' => 'Каталог не сохранён. ' . last_save_error()]);
    }
    json_out(200, ['motors' => $motors, 'sold' => $sold]);
}

// Список проданных для вкладки «Продано».
if ($action === 'soldList') {
    json_out(200, ['sold' => load_json_file(SOLD_FILE)]);
}

// Вернуть мотор из архива обратно в каталог.
if ($action === 'restoreSold') {
    $id = (string) ($payload['id'] ?? '');
    $sold = load_json_file(SOLD_FILE);
    $motor = null;
    foreach ($sold as $item) {
        if (($item['id'] ?? '') === $id) {
            $motor = $item;
            break;
        }
    }
    if ($motor === null) {
        json_out(404, ['error' => 'Мотор не найден в архиве']);
    }
    $sold = array_values(array_filter($sold, static fn($m): bool => ($m['id'] ?? '') !== $id));
    unset($motor['soldAt'], $motor['soldPrice']);

    // Если мотор с таким id уже вернули, второй раз не добавляем.
    $exists = false;
    foreach ($motors as $item) {
        if (($item['id'] ?? '') === $id) {
            $exists = true;
            break;
        }
    }
    if (!$exists) {
        $motors[] = $motor;
    }

    backup_catalog();
    if (!save_json_file(MOTORS_FILE, $motors)) {
        json_out(500, ['error' => 'Каталог не сохранён. ' . last_save_error()]);
    }
    save_json_file(SOLD_FILE, $sold);
    json_out(200, ['motors' => $motors, 'sold' => $sold]);
}

// Удалить из архива насовсем — вместе с фотографиями.
if ($action === 'purgeSold') {
    $id = (string) ($payload['id'] ?? '');
    $sold = load_json_file(SOLD_FILE);
    $before = count($sold);
    $sold = array_values(array_filter($sold, static fn($m): bool => ($m['id'] ?? '') !== $id));
    if (count($sold) === $before) {
        json_out(404, ['error' => 'Мотор не найден в архиве']);
    }
    save_json_file(SOLD_FILE, $sold);
    delete_photos($id);
    json_out(200, ['sold' => $sold]);
}

if ($action === 'save') {
    $input = is_array($payload['motor'] ?? null) ? $payload['motor'] : [];
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        $id = 'm' . time();
    }

    $photoUrls = [];
    $mainUrl = '';
    $seq = 1;
    foreach (is_array($input['photos'] ?? null) ? $input['photos'] : [] as $photo) {
        if (!is_array($photo)) {
            continue;
        }
        if (($photo['type'] ?? '') === 'new') {
            $url = store_photo($id, (string) ($photo['filename'] ?? 'photo.jpg'), (string) ($photo['dataBase64'] ?? ''), $seq);
            if ($url === null) {
                json_out(400, ['error' => 'Не удалось сохранить фотографию — принимаются только JPG, PNG и WebP']);
            }
            $seq++;
        } else {
            $url = (string) ($photo['url'] ?? '');
        }
        if ($url === '') {
            continue;
        }
        $photoUrls[] = $url;
        if (!empty($photo['isMain'])) {
            $mainUrl = $url;
        }
    }
    if ($mainUrl === '' && $photoUrls !== []) {
        $mainUrl = $photoUrls[0];
    }

    $brand = (string) ($input['brand'] ?? '');
    $record = [
        'id' => $id,
        'brand' => $brand,
        'brandLabel' => BRAND_LABELS[$brand] ?? $brand,
        'title' => trim((string) ($input['title'] ?? '')),
        'price' => (int) ($input['price'] ?? 0),
        'img' => $mainUrl,
        'photos' => $photoUrls,
        'videos' => is_array($input['videos'] ?? null) ? $input['videos'] : [],
        'specs' => is_array($input['specs'] ?? null) ? $input['specs'] : [],
    ];
    if (!empty($input['badge'])) {
        $record['badge'] = (string) $input['badge'];
    }
    if ($record['title'] === '') {
        json_out(400, ['error' => 'Не заполнено название мотора']);
    }

    $replaced = false;
    foreach ($motors as $i => $motor) {
        if (($motor['id'] ?? '') === $id) {
            $motors[$i] = $record;
            $replaced = true;
            break;
        }
    }
    if (!$replaced) {
        $motors[] = $record;
    }

    backup_catalog();
    if (!save_json_file(MOTORS_FILE, $motors)) {
        json_out(500, ['error' => 'Каталог не сохранён. ' . last_save_error()]);
    }
    json_out(200, ['motors' => $motors, 'saved' => $record]);
}

json_out(400, ['error' => 'Неизвестное действие']);
