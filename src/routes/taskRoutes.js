// routes/taskRoutes.js - маршруты для сущности «Задача»
const express = require('express');
const router = express.Router();
const taskRepo = require('../repositories/taskRepository');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { assertProjectAccess } = require('../middleware/projectAccess');
const { taskQuery, taskPostBody, taskPatchBody } = require('../middleware/validate');

// GET /api/tasks?projectId=1&statusId=2&priority=high - список задач
router.get('/', authenticateToken, taskQuery, async (req, res, next) => {
    try {
        const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;

        // Без фильтра по проекту возвращаются задачи всех доступных проектов:
        // владелец видит свои проекты, исполнитель - задачи, назначенные ему
        if (projectId && !(await assertProjectAccess(req.user, projectId))) {
            return res.status(403).json({ error: 'Нет доступа к проекту' });
        }

        const tasks = await taskRepo.getTasks({
            projectId,
            statusId: req.query.statusId ? Number(req.query.statusId) : undefined,
            priority: req.query.priority,
            assigneeId: req.query.assigneeId ? Number(req.query.assigneeId) : undefined,
            viewerId: req.user.id,
            viewerRole: req.user.role
        });
        res.json(tasks);
    } catch (err) {
        next(err);
    }
});

// GET /api/tasks/:id - получение задачи по идентификатору
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        // Нечисловой идентификатор - ошибка клиента, а не сервера
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор задачи' });
        }

        const task = await taskRepo.getTaskById(id);
        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }
        // Отсутствие прав проверяется после существования записи,
        // чтобы не подтверждать существование чужих задач
        if (!(await assertProjectAccess(req.user, task.project_id))) {
            return res.status(403).json({ error: 'Нет доступа к задаче' });
        }
        res.json(task);
    } catch (err) {
        next(err);
    }
});

// POST /api/tasks - создание задачи (manager и admin)
// Обязательные поля, приоритет и формат срока проверяет middleware taskPostBody
router.post('/', authenticateToken, requireRole('manager', 'admin'), taskPostBody, async (req, res, next) => {
    try {
        const { project_id, status_id, title, description, priority, due_date, assignee_id } = req.body;

        if (!(await assertProjectAccess(req.user, project_id))) {
            return res.status(403).json({ error: 'Создание задачи доступно только в своём проекте' });
        }

        const id = await taskRepo.createTask({
            projectId: project_id,
            statusId: status_id,
            title,
            description,
            priority,
            dueDate: due_date,
            authorId: req.user.id,
            assigneeId: assignee_id
        });

        const created = await taskRepo.getTaskById(id);
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/tasks/:id - изменение полей задачи (manager и admin)
// Приоритет, срок и ссылочные поля проверяет middleware taskPatchBody
router.patch('/:id', authenticateToken, requireRole('manager', 'admin'), taskPatchBody, async (req, res, next) => {
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

        await taskRepo.updateTask(id, {
            title: req.body.title,
            description: req.body.description,
            priority: req.body.priority,
            dueDate: req.body.due_date,
            statusId: req.body.status_id,
            assigneeId: req.body.assignee_id
        });

        const updated = await taskRepo.getTaskById(id);
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/tasks/:id/status - смена статуса задачи
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const statusId = Number(req.body.status_id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор задачи' });
        }
        if (!Number.isInteger(statusId) || statusId <= 0) {
            return res.status(400).json({ error: 'Не указан status_id' });
        }

        const task = await taskRepo.getTaskById(id);
        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        // Статус меняет назначенный исполнитель, владелец проекта или admin
        const isAssignee = task.assignee_id === req.user.id;
        if (!isAssignee && !(await assertProjectAccess(req.user, task.project_id))) {
            return res.status(403).json({ error: 'Изменение статуса доступно исполнителю задачи' });
        }

        // Статус должен принадлежать тому же проекту, что и задача
        const status = await taskRepo.getStatusInProject(statusId, task.project_id);
        if (!status) {
            return res.status(400).json({ error: 'Статус не относится к проекту задачи' });
        }

        await taskRepo.updateTask(id, { statusId });
        const updated = await taskRepo.getTaskById(id);
        res.json({ message: 'Статус задачи изменён', task: updated });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/tasks/:id - удаление задачи
router.delete('/:id', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
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

        await taskRepo.deleteTask(id);
        res.json({ message: 'Задача удалена', id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
