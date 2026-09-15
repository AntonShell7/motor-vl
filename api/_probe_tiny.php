<?php
// Временный пробник: проверяем, доезжает ли до сервера простой PHP-файл.
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => true, 'probe' => 'tiny'], JSON_UNESCAPED_UNICODE);
