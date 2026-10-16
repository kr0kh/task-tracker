// routes/labelTaskRoutes.js - назначение меток задачам
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const taskRepo = require('../repositories/taskRepository');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { assertProjectAccess } = require('../middleware/projectAccess');

// POST /api/tasks/:id/labels - назначение метки задаче (manager, admin)
router.post('/:id/labels', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const labelId = Number(req.body.label_id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор задачи' });
        }
        if (!Number.isInteger(labelId) || labelId <= 0) {
            return res.status(400).json({ error: 'Не указан label_id' });
        }

        const task = await taskRepo.getTaskById(id);
        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }
        if (!(await assertProjectAccess(req.user, task.project_id))) {
            return res.status(403).json({ error: 'Нет доступа к задаче' });
        }

        // Повторное назначение той же метки отклоняется: пара (task_id, label_id) -
        // первичный ключ связующей таблицы, дублирование невозможно
        await pool.query(
            'INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', [id, labelId]
        );
        res.status(201).json({ message: 'Метка назначена задаче', task_id: id, label_id: labelId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Эта метка уже назначена задаче' });
        }
        next(err);
    }
});

module.exports = router;
