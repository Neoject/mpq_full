<?php

// backend/login.php
session_start();

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error'   => 'Method not allowed',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (function_exists('load_env_from_file')) {
    load_env_from_file();
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Invalid JSON body',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$login = (string)($data['login'] ?? '');
$password = (string)($data['password'] ?? '');

$expectedLogin = (string)(getenv('ADMIN_LOGIN') ?: '');
$expectedPassword = (string)(getenv('ADMIN_PASSWORD') ?: '');

if ($expectedLogin === '' || $expectedPassword === '') {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Admin credentials are not configured',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Constant-time compare to avoid timing leaks
$ok = hash_equals($expectedLogin, $login) && hash_equals($expectedPassword, $password);

if (!$ok) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error'   => 'Неверный логин или пароль',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

session_regenerate_id(true);
$_SESSION['admin_authenticated'] = true;

echo json_encode([
    'success' => true,
    'message' => 'ok',
], JSON_UNESCAPED_UNICODE);

