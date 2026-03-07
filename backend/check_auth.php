<?php

// backend/check_auth.php
session_start();

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

// Подтягиваем переменные окружения, если нужно
if (function_exists('load_env_from_file')) {
    load_env_from_file();
}

$isAuthed = !empty($_SESSION['admin_authenticated']);

echo json_encode([
    'success'       => true,
    'authenticated' => $isAuthed,
], JSON_UNESCAPED_UNICODE);

