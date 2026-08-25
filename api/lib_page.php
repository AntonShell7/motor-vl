<?php
// Общие куски страниц для motor.php.
//
// Шапку, меню и подвал берём прямо из catalog.html, а не копируем: иначе
// при любой правке дизайна страница мотора начнёт отличаться от остальных.

declare(strict_types=1);

function page_chunk(string $html, string $from, string $to): string
{
    $start = strpos($html, $from);
    if ($start === false) {
        return '';
    }
    $end = strpos($html, $to, $start);
    if ($end === false) {
        return '';
    }
    return substr($html, $start, $end - $start + strlen($to));
}

// Возвращает [шапка+меню, подвал+нижняя панель+лайтбокс, версии css/js].
function page_parts(string $catalogPath): array
{
    $html = is_file($catalogPath) ? (string) file_get_contents($catalogPath) : '';
    if ($html === '') {
        return ['', '', '', ''];
    }

    $header = page_chunk($html, '<header class="site-header">', '</header>')
        . "\n" . page_chunk($html, '<div class="mobile-nav">', "</div>\n</div>");

    $footer = page_chunk($html, '<footer class="site-footer">', '</footer>')
        . "\n" . page_chunk($html, '<div class="mobile-call-bar">', '</div>')
        . "\n" . page_chunk($html, '<button class="back-to-top"', '</button>')
        . "\n" . page_chunk($html, '<div class="lightbox">', "</div>\n</div>\n</div>");

    // Версии в ссылках на стили и скрипты — чтобы страница мотора не осталась
    // со старым оформлением после правок.
    preg_match('~css/style\.css\?v=[a-f0-9]+~', $html, $cssMatch);
    preg_match('~js/main\.js\?v=[a-f0-9]+~', $html, $jsMatch);

    return [$header, $footer, $cssMatch[0] ?? 'css/style.css', $jsMatch[0] ?? 'js/main.js'];
}
