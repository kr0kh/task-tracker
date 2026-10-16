// repositories/commentRepository.js - CRUD для сущности «Комментарий»
const pool = require('../db/pool');

async function createComment(data) {
    const [result] = await pool.query(
        'INSERT INTO comments (task_id, author_id, body) VALUES (?, ?, ?)',
        [data.taskId, data.authorId, data.body]
    );
    return result.insertId;
}

async function getCommentsByTask(taskId) {
    const [rows] = await pool.query(
        `SELECT c.id, c.body, c.created_at,
                u.full_name AS author_name, u.role AS author_role
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.task_id = ?
         ORDER BY c.created_at ASC`,
        [taskId]
    );
    return rows;
}

async function updateComment(id, body) {
    const [result] = await pool.query(
        'UPDATE comments SET body = ? WHERE id = ?', [body, id]
    );
    return result.affectedRows > 0;
}

async function deleteComment(id) {
    const [result] = await pool.query('DELETE FROM comments WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { createComment, getCommentsByTask, updateComment, deleteComment };
