// repositories/userRepository.js - CRUD для сущности «Пользователь»
const pool = require('../db/pool');

async function createUser(data) {
    const [result] = await pool.query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [data.fullName, data.email, data.passwordHash, data.role ?? 'executor']
    );
    return result.insertId;
}

// Поле password_hash наружу не отдаётся - только те поля, что нужны API
async function getUserById(id) {
    const [rows] = await pool.query(
        'SELECT id, full_name, email, role, created_at FROM users WHERE id = ?',
        [id]
    );
    return rows[0] ?? null;
}

async function getUsers() {
    const [rows] = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.role, u.created_at,
                COUNT(t.id) AS assigned_tasks
         FROM users u
         LEFT JOIN tasks t ON t.assignee_id = u.id
         GROUP BY u.id, u.full_name, u.email, u.role, u.created_at
         ORDER BY u.id`
    );
    return rows;
}

async function updateUser(id, data) {
    const [result] = await pool.query(
        `UPDATE users
         SET full_name = COALESCE(?, full_name),
             role = COALESCE(?, role)
         WHERE id = ?`,
        [data.fullName ?? null, data.role ?? null, id]
    );
    return result.affectedRows > 0;
}

async function deleteUser(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { createUser, getUserById, getUsers, updateUser, deleteUser };
