<?php

// backend/list_assessments.php
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

try {
    $pdo = get_pdo_connection();

    // Определяем тип формы из GET-параметра
    $form = isset($_GET['form']) ? trim($_GET['form']) : 'full';
    $isShort = ($form === 'short');

    $assessmentsTable = $isShort ? 'm_assessments' : 'assessments';
    $patientsTable = $isShort ? 'm_patients' : 'patients';

    $stmt = $pdo->query("
        SELECT
            a.id AS assessment_id,
            COALESCE(p.full_name, '') AS full_name,
            a.created_at,
            a.total_score,
            a.sensory_score,
            a.affective_score,
            a.evaluative_score,
            a.misc_score,
            a.vas_score,
            a.ppi_score,
            a.questionnaire_type
        FROM {$assessmentsTable} a
        LEFT JOIN {$patientsTable} p ON a.patient_id = p.id
        ORDER BY a.created_at DESC, a.id DESC
    ");

    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'items'   => $items,
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'List error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

