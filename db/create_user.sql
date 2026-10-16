-- db/create_user.sql - создание базы данных и отдельного пользователя
-- Приложение подключается не под root: у пользователя только права на свою базу
CREATE DATABASE IF NOT EXISTS task_tracker
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tracker_user'@'localhost' IDENTIFIED BY 'tracker_pass';

GRANT SELECT, INSERT, UPDATE, DELETE ON task_tracker.* TO 'tracker_user'@'localhost';

FLUSH PRIVILEGES;

-- Проверка выданных прав
SHOW GRANTS FOR 'tracker_user'@'localhost';
