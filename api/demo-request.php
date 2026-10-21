<?php
/**
 * BOSS — demo request endpoint.
 *
 * Accepts the "Book a demo" form (POST), validates it and appends one row to
 * data/demo-requests.csv (the data/ folder is blocked from the web by its .htaccess).
 * Responds with JSON for the page's fetch() call, or redirects back for a plain
 * form post when JavaScript is off.
 *
 * To also get an email per request, set NOTIFY_EMAIL below and configure
 * sendmail in XAMPP (php.ini / sendmail.ini).
 */

declare(strict_types=1);

date_default_timezone_set('Asia/Manila');

const NOTIFY_EMAIL = '';            // e.g. 'sales@yourcompany.com' — leave empty to skip email
const MAX_PER_HOUR_PER_IP = 5;

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function respond(bool $ok, string $message, int $status, bool $json): void
{
    if ($json) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message]);
    } else {
        header('Location: ../index.html?demo=' . ($ok ? 'sent' : 'error') . '#demo', true, 303);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(false, 'Method not allowed.', 405, $wantsJson);
}

// Honeypot: real people never fill the hidden "_honey" field.
if (trim((string)($_POST['_honey'] ?? '')) !== '') {
    respond(true, 'Thank you.', 200, $wantsJson);
}

$clean = static fn(string $key, int $max): string =>
    mb_substr(trim(preg_replace('/\s+/u', ' ', (string)($_POST[$key] ?? ''))), 0, $max);

$name     = $clean('name', 80);
$company  = $clean('company', 120);
$email    = $clean('email', 120);
$phone    = $clean('phone', 30);
$industry = $clean('industry', 60);
$message  = mb_substr(trim((string)($_POST['message'] ?? '')), 0, 1000);

$allowedModules = ['Sales', 'Inventory', 'Purchasing', 'Production', 'Reports', 'Management'];
$modules = array_values(array_intersect($allowedModules, (array)($_POST['modules'] ?? [])));

$errors = [];
if ($name === '')     $errors[] = 'your name';
if ($company === '')  $errors[] = 'your business name';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'a valid email';
if ($industry === '') $errors[] = 'your type of business';
if ($phone !== '' && !preg_match('/^[0-9+()\-\s]{7,30}$/', $phone)) $errors[] = 'a valid mobile number';
if ($errors) {
    respond(false, 'Please enter ' . implode(', ', $errors) . '.', 422, $wantsJson);
}

$dataDir = dirname(__DIR__) . '/data';
if (!is_dir($dataDir) && !mkdir($dataDir, 0750, true) && !is_dir($dataDir)) {
    respond(false, 'We could not save your request. Please try again later.', 500, $wantsJson);
}

// Simple per-IP rate limit.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = $dataDir . '/.rate-' . hash('sha256', $ip);
$recent = is_file($rateFile) ? array_filter(
    array_map('intval', file($rateFile, FILE_IGNORE_NEW_LINES) ?: []),
    static fn(int $t): bool => $t > time() - 3600
) : [];
if (count($recent) >= MAX_PER_HOUR_PER_IP) {
    respond(false, 'Too many requests from this connection. Please try again in an hour.', 429, $wantsJson);
}
$recent[] = time();
file_put_contents($rateFile, implode("\n", $recent), LOCK_EX);

// Neutralise spreadsheet formula injection (cells starting with = + - @).
$cell = static fn(string $v): string => preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v;

$csv = $dataDir . '/demo-requests.csv';
$isNew = !is_file($csv);
$fh = fopen($csv, 'ab');
if ($fh === false || !flock($fh, LOCK_EX)) {
    respond(false, 'We could not save your request. Please try again later.', 500, $wantsJson);
}
if ($isNew) {
    fputcsv($fh, ['received_at', 'name', 'company', 'email', 'phone', 'industry', 'modules', 'message', 'ip']);
}
fputcsv($fh, array_map($cell, [
    date('c'), $name, $company, $email, $phone, $industry, implode('; ', $modules), $message, $ip,
]));
flock($fh, LOCK_UN);
fclose($fh);

if (NOTIFY_EMAIL !== '') {
    $body = "New BOSS demo request\n\nName: $name\nBusiness: $company\nEmail: $email\nMobile: $phone\n"
          . "Type: $industry\nModules: " . implode(', ', $modules) . "\n\n$message\n";
    @mail(NOTIFY_EMAIL, 'BOSS demo request — ' . $company, $body, 'Reply-To: ' . $email);
}

respond(true, "Thank you, $name. We received your request and will contact you to schedule your demo.", 200, $wantsJson);
