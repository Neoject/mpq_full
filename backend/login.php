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

try {
    $pdo = get_pdo_connection();
    $stmt = $pdo->prepare("
        SELECT id, login, password_hash, role
        FROM users
        WHERE login = :login
        LIMIT 1
    ");
    $stmt->execute([':login' => $login]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error'   => 'Неверный логин или пароль',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'DB auth error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

session_regenerate_id(true);
$_SESSION['admin_authenticated'] = true;
$_SESSION['user_id'] = $user['id'] ?? null;
$_SESSION['user_login'] = $user['login'] ?? null;
$_SESSION['user_role'] = $user['role'] ?? null;

echo json_encode([
    'success' => true,
    'message' => 'ok',
], JSON_UNESCAPED_UNICODE);

