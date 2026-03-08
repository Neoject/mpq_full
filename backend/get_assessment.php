<?php

// backend/get_assessment.php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error'   => 'Method not allowed',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Invalid id',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Определяем тип формы из GET-параметра
$form = isset($_GET['form']) ? trim($_GET['form']) : 'full';
$isShort = ($form === 'short');

$assessmentsTable = $isShort ? 'm_assessments' : 'assessments';
$patientsTable = $isShort ? 'm_patients' : 'patients';

try {
    $pdo = get_pdo_connection();

    $stmt = $pdo->prepare("
        SELECT
            a.*,
            COALESCE(p.full_name, '') AS full_name
        FROM {$assessmentsTable} a
        LEFT JOIN {$patientsTable} p ON a.patient_id = p.id
        WHERE a.id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Assessment not found',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Декодируем JSON с дескрипторами боли
    if (isset($row['pain_descriptors']) && $row['pain_descriptors'] !== null) {
        $decoded = json_decode($row['pain_descriptors'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $row['pain_descriptors'] = $decoded;
        }
    }
    if (isset($row['body_map']) && is_string($row['body_map'])) {
        $decoded = json_decode($row['body_map'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $row['body_map'] = $decoded;
        }
    }

    echo json_encode([
        'success'    => true,
        'assessment' => $row,
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Get error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

