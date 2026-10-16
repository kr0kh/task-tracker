// repositories/taskRepository.js - CRUD для сущности «Задача»
const pool = require('../db/pool');

// CREATE - создание задачи
async function createTask(data) {
    const [result] = await pool.query(
        `INSERT INTO tasks
            (project_id, status_id, title, description, priority, due_date, author_id, assignee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.projectId, data.statusId, data.title, data.description ?? null,
         data.priority ?? 'low', data.dueDate ?? null, data.authorId, data.assigneeId ?? null]
    );
    return result.insertId;
}

// READ - получение задачи по идентификатору
async function getTaskById(id) {
    const [rows] = await pool.query(
        `SELECT t.id, t.title, t.description, t.priority, t.due_date,
                t.project_id, t.status_id, t.author_id, t.assignee_id, t.created_at,
                s.name AS status_name, u.full_name AS assignee_name
         FROM tasks t
         JOIN statuses s ON s.id = t.status_id
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.id = ?`,
        [id]
    );
    return rows[0] ?? null;   // null, если записи нет - вызывающий код решает, что вернуть
}

// READ - список задач с фильтрацией и учётом прав пользователя
async function getTasks(filter = {}) {
    const conditions = [];
    const params = [];

    if (filter.projectId) {
        conditions.push('t.project_id = ?');
        params.push(filter.projectId);
    }
    if (filter.statusId) {
        conditions.push('t.status_id = ?');
        params.push(filter.statusId);
    }
    if (filter.assigneeId) {
        conditions.push('t.assignee_id = ?');
        params.push(filter.assigneeId);
    }
    if (filter.priority) {
        conditions.push('t.priority = ?');
        params.push(filter.priority);
    }

    // Разграничение доступа выполняется в самом запросе, а не после выборки:
    // исполнитель получает только назначенные ему задачи, владелец проекта -
    // все задачи своих проектов, admin - все задачи без ограничений
    if (filter.viewerRole === 'executor') {
        conditions.push('t.assignee_id = ?');
        params.push(filter.viewerId);
    } else if (filter.viewerRole === 'manager') {
        conditions.push('p.owner_id = ?');
        params.push(filter.viewerId);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
        `SELECT t.*, s.name AS status_name, u.full_name AS assignee_name
         FROM tasks t
         JOIN statuses s ON s.id = t.status_id
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN users u ON u.id = t.assignee_id
         ${where}
         ORDER BY t.created_at DESC`,
        params
    );
    return rows;
}

// UPDATE - изменение полей задачи
async function updateTask(id, data) {
    const fields = [];
    const params = [];

    const allowed = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        statusId: data.statusId,
        assigneeId: data.assigneeId
    };
    const columns = {
        title: 'title', description: 'description', priority: 'priority',
        dueDate: 'due_date', statusId: 'status_id', assigneeId: 'assignee_id'
    };

    for (const [key, value] of Object.entries(allowed)) {
        if (value !== undefined) {
            fields.push(`${columns[key]} = ?`);
            params.push(value);
        }
    }

    if (fields.length === 0) return false;

    params.push(id);
    const [result] = await pool.query(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
        params
    );
    return result.affectedRows > 0;   // false, если задачи с таким id нет
}

// DELETE - удаление задачи
async function deleteTask(id) {
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

// READ - проверка, что статус принадлежит проекту задачи
// (у каждого проекта свои колонки, чужой status_id привёл бы к рассинхронизации)
async function getStatusInProject(statusId, projectId) {
    const [rows] = await pool.query(
        'SELECT id, name FROM statuses WHERE id = ? AND project_id = ?',
        [statusId, projectId]
    );
    return rows[0] ?? null;
}

module.exports = { createTask, getTaskById, getTasks, updateTask, deleteTask, getStatusInProject };
