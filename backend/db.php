<?php

// backend/db.php

function load_env_from_file(): void
{
    // Ожидаем .env в корне проекта (на уровень выше backend/)
    $envPath = __DIR__ . '/../.env';
    if (!is_readable($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$name, $value] = explode('=', $line, 2);
        $name  = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        if ($name === '') {
            continue;
        }
        // Не перезаписываем уже существующие переменные окружения
        if (getenv($name) === false) {
            putenv($name . '=' . $value);
        }
    }
}

function ensure_schema(PDO $pdo): void
{
    // Таблица пользователей (для авторизации в админке)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            login VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

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

    // Таблица пациентов для короткой формы (m_)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS m_patients (
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

    // Таблица оценок боли для короткой формы (m_)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS m_assessments (
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
            CONSTRAINT fk_m_assessments_patient
                FOREIGN KEY (patient_id)
                REFERENCES m_patients(id)
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

    // Заодно гарантируем те же поля и для m_assessments, если таблица уже существовала
    $addColumnIfMissing('m_assessments', 'body_map', 'body_map JSON NULL');
    $addColumnIfMissing('m_assessments', 'evaluative_score', 'evaluative_score INT NULL');
    $addColumnIfMissing('m_assessments', 'misc_score', 'misc_score INT NULL');
    $addColumnIfMissing('m_assessments', 'questionnaire_type', "questionnaire_type VARCHAR(32) NULL");

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
}

function get_pdo_connection(): PDO
{
    load_env_from_file();

    $host = getenv('DB_HOST');
    $user = getenv('DB_USER');
    $pass = getenv('DB_PASSWORD');
    $dbname = getenv('DB_NAME');
    $port = getenv('DB_PORT');

    $charset = 'utf8mb4';

    try {
        // Первое подключение без имени БД — чтобы создать её при необходимости
        $dsnNoDb = "mysql:host={$host};port={$port};charset={$charset}";
        $pdo = new PDO($dsnNoDb, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        // Создаём БД, если её нет
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET {$charset} COLLATE {$charset}_unicode_ci");

        // Переподключаемся к целевой БД
        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        // Гарантируем наличие таблиц/колонок при первом обращении
        ensure_schema($pdo);

        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'DB connection error: ' . $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

