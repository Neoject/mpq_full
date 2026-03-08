<?php

// backend/save_assessment.php
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

// Читаем JSON из тела запроса
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

$fullName  = trim($data['patientName'] ?? '');
$total     = (int)($data['total'] ?? 0);
$sensory   = (int)($data['sensory'] ?? 0);
$affective = (int)($data['affective'] ?? 0);
$evaluative = (int)($data['pri_evaluative'] ?? ($data['evaluative'] ?? 0));
$misc      = (int)($data['pri_misc'] ?? ($data['misc'] ?? 0));
$vas       = (int)($data['vas'] ?? 0);
$ppi       = (int)($data['ppi'] ?? 0);
$scores    = $data['scores'] ?? null;
$bodyMap   = $data['bodyMap'] ?? null;

// Определяем тип анкеты (полная MPQ или короткая SF‑MPQ)
// 1) Если явно передан questionnaire_type / questionnaireType — используем его.
// 2) Иначе пытаемся определить по структуре данных:
//    - наличие bodyMap / pri / pri_evaluative / pri_misc → считаем полной MPQ;
//    - иначе — короткая форма SF‑MPQ.
$questionnaireTypeRaw = $data['questionnaire_type'] ?? $data['questionnaireType'] ?? null;
if ($questionnaireTypeRaw !== null && trim((string)$questionnaireTypeRaw) !== '') {
    $questionnaireType = trim((string)$questionnaireTypeRaw);
} else {
    $isFullMpq = array_key_exists('bodyMap', $data)
        || array_key_exists('pri', $data)
        || array_key_exists('pri_evaluative', $data)
        || array_key_exists('pri_misc', $data);

    $questionnaireType = $isFullMpq ? 'mpq_full' : 'mpq_short';
}

// Нормализация JSON-полей: сохраняем только валидные структуры
if (!is_array($scores)) {
    $scores = null;
}

if (is_array($bodyMap)) {
    $front = $bodyMap['front'] ?? [];
    $back  = $bodyMap['back'] ?? [];
    $front = is_array($front) ? array_values(array_filter($front, 'is_string')) : [];
    $back  = is_array($back) ? array_values(array_filter($back, 'is_string')) : [];
    $bodyMap = ['front' => $front, 'back' => $back];
} else {
    $bodyMap = null;
}

try {
    $pdo = get_pdo_connection();
    $pdo->beginTransaction();

    // Определяем, в какие таблицы сохранять
    $isShort = ($questionnaireType === 'mpq_short' || $questionnaireType === 'short');
    $assessmentsTable = $isShort ? 'm_assessments' : 'assessments';
    $patientsTable = $isShort ? 'm_patients' : 'patients';

    $patientId = null;
    if ($fullName !== '') {
        $stmt = $pdo->prepare("
            INSERT INTO {$patientsTable} (full_name)
            VALUES (:full_name)
        ");
        $stmt->execute([':full_name' => $fullName]);
        $patientId = (int)$pdo->lastInsertId();
    }

    $stmt = $pdo->prepare("
        INSERT INTO {$assessmentsTable} (
            patient_id,
            total_score,
            sensory_score,
            affective_score,
            evaluative_score,
            misc_score,
            vas_score,
            ppi_score,
            pain_descriptors,
            body_map,
            questionnaire_type
        ) VALUES (
            :patient_id,
            :total_score,
            :sensory_score,
            :affective_score,
            :evaluative_score,
            :misc_score,
            :vas_score,
            :ppi_score,
            :pain_descriptors,
            :body_map,
            :questionnaire_type
        )
    ");

    $stmt->execute([
        ':patient_id'       => $patientId ?: null,
        ':total_score'      => $total,
        ':sensory_score'    => $sensory,
        ':affective_score'  => $affective,
        ':evaluative_score' => $evaluative,
        ':misc_score'       => $misc,
        ':vas_score'        => $vas,
        ':ppi_score'        => $ppi,
        ':pain_descriptors' => is_array($scores) ? json_encode($scores, JSON_UNESCAPED_UNICODE) : null,
        ':body_map'         => is_array($bodyMap) ? json_encode($bodyMap, JSON_UNESCAPED_UNICODE) : null,
        ':questionnaire_type' => ($questionnaireType !== '' ? $questionnaireType : null),
    ]);

    $assessmentId = (int)$pdo->lastInsertId();

    $pdo->commit();

    echo json_encode([
        'success'       => true,
        'message'       => 'ok',
        'patient_id'    => $patientId,
        'assessment_id' => $assessmentId,
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Save error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

