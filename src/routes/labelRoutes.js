// routes/labelRoutes.js - маршруты для сущности «Метка»
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/labels - список меток
router.get('/labels', authenticateToken, async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT l.id, l.name, l.color, COUNT(tl.task_id) AS tasks_count
             FROM labels l
             LEFT JOIN task_labels tl ON tl.label_id = l.id
             GROUP BY l.id, l.name, l.color
             ORDER BY l.name`
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/labels - создание метки (manager, admin)
router.post('/labels', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const { name, color } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Укажите название метки' });
        }

        const [result] = await pool.query(
            'INSERT INTO labels (name, color) VALUES (?, ?)', [name, color ?? null]
        );
        res.status(201).json({ id: result.insertId, name, color: color ?? null });
    } catch (err) {
        // Название метки уникально (labels.name UNIQUE)
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Метка с таким названием уже существует' });
        }
        next(err);
    }
});

module.exports = router;
