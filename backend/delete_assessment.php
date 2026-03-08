<?php

// backend/delete_assessment.php
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

$id = (int)($data['id'] ?? 0);
if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Invalid id',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Определяем тип формы из параметра
$form = isset($data['form']) ? trim($data['form']) : 'full';
$isShort = ($form === 'short');
$assessmentsTable = $isShort ? 'm_assessments' : 'assessments';

try {
    $pdo = get_pdo_connection();
    $stmt = $pdo->prepare("DELETE FROM {$assessmentsTable} WHERE id = :id");
    $stmt->execute([':id' => $id]);

    echo json_encode([
        'success' => true,
        'message' => 'deleted',
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Delete error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

