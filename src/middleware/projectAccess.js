// middleware/projectAccess.js - проверка участия пользователя в проекте
const pool = require('../db/pool');

// Роль admin имеет доступ ко всем проектам, остальные - только к своим
// (владелец проекта по projects.owner_id либо исполнитель задачи из этого проекта)
async function assertProjectAccess(user, projectId) {
    if (user.role === 'admin') return true;

    const [rows] = await pool.query(
        `SELECT 1
         FROM projects p
         WHERE p.id = ?
           AND (p.owner_id = ?
                OR EXISTS (SELECT 1 FROM tasks t
                           WHERE t.project_id = p.id AND t.assignee_id = ?))
         LIMIT 1`,
        [projectId, user.id, user.id]
    );
    return rows.length > 0;
}

module.exports = { assertProjectAccess };
