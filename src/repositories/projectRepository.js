// repositories/projectRepository.js - CRUD для сущности «Проект»
const pool = require('../db/pool');

async function createProject(data) {
    const [result] = await pool.query(
        'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
        [data.name, data.description ?? null, data.ownerId]
    );
    return result.insertId;
}

async function getProjectById(id) {
    const [rows] = await pool.query(
        `SELECT p.id, p.name, p.description, p.owner_id, p.created_at,
                u.full_name AS owner_name
         FROM projects p
         JOIN users u ON u.id = p.owner_id
         WHERE p.id = ?`,
        [id]
    );
    return rows[0] ?? null;
}

async function getProjects(viewer) {
    // Один запрос вместо отдельного обращения к БД на каждый проект.
    // Участники проекта определяются без отдельной таблицы: это владелец
    // (projects.owner_id) и исполнители задач проекта (tasks.assignee_id)
    const conditions = [];
    const params = [];

    if (viewer.role === 'manager') {
        conditions.push('p.owner_id = ?');
        params.push(viewer.id);
    } else if (viewer.role === 'executor') {
        conditions.push(`(p.owner_id = ?
                          OR EXISTS (SELECT 1 FROM tasks t2
                                     WHERE t2.project_id = p.id AND t2.assignee_id = ?))`);
        params.push(viewer.id, viewer.id);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
        `SELECT p.id, p.name, p.description, p.created_at,
                u.full_name AS owner_name,
                COUNT(t.id) AS tasks_count
         FROM projects p
         JOIN users u ON u.id = p.owner_id
         LEFT JOIN tasks t ON t.project_id = p.id
         ${where}
         GROUP BY p.id, p.name, p.description, p.created_at, u.full_name
         ORDER BY p.created_at DESC`,
        params
    );
    return rows;
}

// Исполнитель, назначенный на задачу проекта, становится его участником
async function isParticipant(userId, projectId) {
    const [rows] = await pool.query(
        `SELECT 1
         FROM projects p
         WHERE p.id = ?
           AND (p.owner_id = ?
                OR EXISTS (SELECT 1 FROM tasks t
                           WHERE t.project_id = p.id AND t.assignee_id = ?))
         LIMIT 1`,
        [projectId, userId, userId]
    );
    return rows.length > 0;
}

async function updateProject(id, data) {
    const [result] = await pool.query(
        'UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
        [data.name ?? null, data.description ?? null, id]
    );
    return result.affectedRows > 0;
}

async function deleteProject(id) {
    const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { createProject, getProjectById, getProjects, isParticipant,
                     updateProject, deleteProject };
