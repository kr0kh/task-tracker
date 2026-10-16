-- ============================================================
-- База данных проекта Task Tracker
-- СУБД: MySQL 8.0, кодировка utf8mb4
-- Скрипт создаёт структуру по ER-схеме из Темы 2
-- ============================================================

DROP DATABASE IF EXISTS task_tracker;
CREATE DATABASE task_tracker
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE task_tracker;

-- 1. Пользователи системы
CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('executor', 'manager', 'admin')
                  NOT NULL DEFAULT 'executor',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Проекты (рабочие пространства)
CREATE TABLE projects (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT NULL,
    owner_id    INT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_owner
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE RESTRICT
);

-- 3. Статусы (колонки канбан-доски), у каждого проекта свои
CREATE TABLE statuses (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    name       VARCHAR(50) NOT NULL,
    position   INT NOT NULL,
    CONSTRAINT fk_statuses_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_statuses_project_name UNIQUE (project_id, name)
);

-- 4. Задачи
CREATE TABLE tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    status_id   INT NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT NULL,
    priority    ENUM('low', 'medium', 'high')
                NOT NULL DEFAULT 'low',
    due_date    DATE NULL,
    closed_at   DATETIME NULL,
    author_id   INT NOT NULL,
    assignee_id INT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tasks_status
        FOREIGN KEY (status_id) REFERENCES statuses(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_author
        FOREIGN KEY (author_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_assignee
        FOREIGN KEY (assignee_id) REFERENCES users(id)
        ON DELETE SET NULL
);

-- 5. Метки
CREATE TABLE labels (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(20) NULL
);

-- 6. Связь задач и меток (многие-ко-многим)
CREATE TABLE task_labels (
    task_id  INT NOT NULL,
    label_id INT NOT NULL,
    PRIMARY KEY (task_id, label_id),
    CONSTRAINT fk_task_labels_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_task_labels_label
        FOREIGN KEY (label_id) REFERENCES labels(id)
        ON DELETE CASCADE
);

-- 7. Комментарии к задачам
CREATE TABLE comments (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    task_id    INT NOT NULL,
    author_id  INT NOT NULL,
    body       TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_comments_author
        FOREIGN KEY (author_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- 8. Индексы на полях с частой фильтрацией и соединением
CREATE INDEX idx_tasks_status      ON tasks (status_id);
CREATE INDEX idx_tasks_project     ON tasks (project_id);
-- Составной индекс под канбан-доску: список задач всегда фильтруется
-- по проекту, чаще всего вместе со статусом (WHERE project_id = ? [AND status_id = ?])
CREATE INDEX idx_tasks_project_status ON tasks (project_id, status_id);
CREATE INDEX idx_tasks_assignee    ON tasks (assignee_id);
CREATE INDEX idx_tasks_priority    ON tasks (priority);
CREATE INDEX idx_tasks_due_date    ON tasks (due_date);
CREATE INDEX idx_tasks_closed_at   ON tasks (closed_at);
CREATE INDEX idx_statuses_project  ON statuses (project_id);
CREATE INDEX idx_comments_task     ON comments (task_id);
CREATE INDEX idx_projects_owner    ON projects (owner_id);
