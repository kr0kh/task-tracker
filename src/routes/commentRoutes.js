// routes/commentRoutes.js - маршруты для сущности «Комментарий»
// Подключается в server.js с префиксом /api/tasks
const express = require('express');
const router = express.Router();
const commentRepo = require('../repositories/commentRepository');
const taskRepo = require('../repositories/taskRepository');
const { authenticateToken } = require('../middleware/auth');
const { assertProjectAccess } = require('../middleware/projectAccess');

// GET /api/tasks/:id/comments - комментарии к задаче
router.get('/:id/comments', authenticateToken, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор задачи' });
        }

        const task = await taskRepo.getTaskById(id);
        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }
        if (!(await assertProjectAccess(req.user, task.project_id))) {
            return res.status(403).json({ error: 'Нет доступа к задаче' });
        }
        res.json(await commentRepo.getCommentsByTask(id));
    } catch (err) {
        next(err);
    }
});

// POST /api/tasks/:id/comments - добавление комментария
router.post('/:id/comments', authenticateToken, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор задачи' });
        }
        if (!req.body.body || String(req.body.body).trim() === '') {
            return res.status(400).json({ error: 'Комментарий не может быть пустым' });
        }

        const task = await taskRepo.getTaskById(id);
        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }
        if (!(await assertProjectAccess(req.user, task.project_id))) {
            return res.status(403).json({ error: 'Нет доступа к задаче' });
        }

        const commentId = await commentRepo.createComment({
            taskId: id, authorId: req.user.id, body: req.body.body
        });
        const comments = await commentRepo.getCommentsByTask(id);
        res.status(201).json(comments.find(c => c.id === commentId));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
