// repositories/statusRepository.js - CRUD для сущности «Статус»
// Статусы - это колонки канбан-доски, они задаются отдельно для каждого проекта
const pool = require('../db/pool');

async function getStatusesByProject(projectId) {
    const [rows] = await pool.query(
        `SELECT s.id, s.project_id, s.name, s.position,
                COUNT(t.id) AS tasks_count
         FROM statuses s
         LEFT JOIN tasks t ON t.status_id = s.id
         WHERE s.project_id = ?
         GROUP BY s.id, s.project_id, s.name, s.position
         ORDER BY s.position`,
        [projectId]
    );
    return rows;
}

async function createStatus(data) {
    // Новый статус ставится в конец: позиция на единицу больше текущего максимума
    const [[{ maxPosition }]] = await pool.query(
        'SELECT COALESCE(MAX(position), 0) AS maxPosition FROM statuses WHERE project_id = ?',
        [data.projectId]
    );

    const [result] = await pool.query(
        'INSERT INTO statuses (project_id, name, position) VALUES (?, ?, ?)',
        [data.projectId, data.name, maxPosition + 1]
    );
    return result.insertId;
}

async function updateStatus(id, data) {
    const [result] = await pool.query(
        'UPDATE statuses SET name = COALESCE(?, name), position = COALESCE(?, position) WHERE id = ?',
        [data.name ?? null, data.position ?? null, id]
    );
    return result.affectedRows > 0;
}

// Удаление возможно, только если в статусе нет задач:
// иначе задачи остались бы без текущего статуса
async function deleteStatus(id) {
    const [[{ tasksCount }]] = await pool.query(
        'SELECT COUNT(*) AS tasksCount FROM tasks WHERE status_id = ?', [id]
    );
    if (tasksCount > 0) {
        return { deleted: false, reason: 'В статусе есть задачи' };
    }

    const [result] = await pool.query('DELETE FROM statuses WHERE id = ?', [id]);
    return { deleted: result.affectedRows > 0 };
}

module.exports = { getStatusesByProject, createStatus, updateStatus, deleteStatus };
