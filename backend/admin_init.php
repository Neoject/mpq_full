<?php

// backend/admin_init.php
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

try {
    $pdo = get_pdo_connection();

    // Таблица пациентов
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS patients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            birth_date DATE NULL,
            gender ENUM('male', 'female', 'other') NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Таблица оценок боли
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS assessments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NULL,
            total_score INT,
            sensory_score INT,
            affective_score INT,
            evaluative_score INT NULL,
            misc_score INT NULL,
            vas_score INT,
            ppi_score INT,
            pain_descriptors JSON,
            body_map JSON NULL,
            questionnaire_type VARCHAR(32) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_assessments_patient
                FOREIGN KEY (patient_id)
                REFERENCES patients(id)
                ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Миграции: добавить недостающие колонки в существующей таблице
    $addColumnIfMissing = function(string $table, string $column, string $ddl) use ($pdo): void {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c
        ");
        $stmt->execute([':t' => $table, ':c' => $column]);
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN {$ddl}");
        }
    };

    $addColumnIfMissing('assessments', 'body_map', 'body_map JSON NULL');
    $addColumnIfMissing('assessments', 'evaluative_score', 'evaluative_score INT NULL');
    $addColumnIfMissing('assessments', 'misc_score', 'misc_score INT NULL');
    $addColumnIfMissing('assessments', 'questionnaire_type', "questionnaire_type VARCHAR(32) NULL");

    // Таблица логов активности
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            action VARCHAR(255),
            details JSON,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    echo json_encode([
        'success' => true,
        'message' => 'Database initialized successfully',
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database initialization error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

