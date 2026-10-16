// routes/projectRoutes.js - маршруты для сущностей «Проект» и «Статус»
const express = require('express');
const router = express.Router();
const projectRepo = require('../repositories/projectRepository');
const statusRepo = require('../repositories/statusRepository');
const taskRepo = require('../repositories/taskRepository');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/projects - список доступных пользователю проектов
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        res.json(await projectRepo.getProjects(req.user));
    } catch (err) {
        next(err);
    }
});

// POST /api/projects - создание проекта (manager, admin)
router.post('/', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Укажите название проекта' });
        }

        const id = await projectRepo.createProject({ name, description, ownerId: req.user.id });
        res.status(201).json(await projectRepo.getProjectById(id));
    } catch (err) {
        next(err);
    }
});

// GET /api/projects/:id - проект и его задачи
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
        }

        const project = await projectRepo.getProjectById(id);
        if (!project) {
            return res.status(404).json({ error: 'Проект не найден' });
        }
        if (!(await projectRepo.isParticipant(req.user.id, id)) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа к проекту' });
        }

        // Задачи проекта возвращаются вместе с проектом одним ответом
        const tasks = await taskRepo.getTasks({
            projectId: id,
            viewerId: req.user.id,
            viewerRole: req.user.role
        });
        res.json({ project, tasks });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/projects/:id - изменение проекта (manager, admin)
router.patch('/:id', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
        }

        const project = await projectRepo.getProjectById(id);
        if (!project) {
            return res.status(404).json({ error: 'Проект не найден' });
        }
        if (!(await projectRepo.isParticipant(req.user.id, id)) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Изменять можно только свои проекты' });
        }

        await projectRepo.updateProject(id, req.body);
        res.json(await projectRepo.getProjectById(id));
    } catch (err) {
        next(err);
    }
});

// DELETE /api/projects/:id - удаление проекта
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
        }

        const deleted = await projectRepo.deleteProject(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Проект не найден' });
        }
        // Связанные статусы, задачи и комментарии удаляются каскадно (ON DELETE CASCADE)
        res.json({ message: 'Проект удалён', id });
    } catch (err) {
        next(err);
    }
});

// GET /api/projects/:id/statuses - колонки канбан-доски проекта
router.get('/:id/statuses', authenticateToken, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
        }
        if (!(await projectRepo.isParticipant(req.user.id, id)) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа к проекту' });
        }
        res.json(await statusRepo.getStatusesByProject(id));
    } catch (err) {
        next(err);
    }
});

// POST /api/projects/:id/statuses - создание статуса (manager, admin)
router.post('/:id/statuses', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
        }
        if (!req.body.name) {
            return res.status(400).json({ error: 'Укажите название статуса' });
        }
        if (!(await projectRepo.isParticipant(req.user.id, id)) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа к проекту' });
        }

        const statusId = await statusRepo.createStatus({ projectId: id, name: req.body.name });
        res.status(201).json({ id: statusId, project_id: id, name: req.body.name });
    } catch (err) {
        // Название статуса уникально в пределах проекта (uq_statuses_project_name)
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Статус с таким названием уже есть в проекте' });
        }
        next(err);
    }
});

// PATCH /api/projects/statuses/:id - изменение названия или порядка статуса
// Объявлен до /:id, иначе строка "statuses" была бы воспринята как идентификатор проекта
router.patch('/statuses/:id', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор статуса' });
        }
        const updated = await statusRepo.updateStatus(id, req.body);
        if (!updated) {
            return res.status(404).json({ error: 'Статус не найден' });
        }
        res.json({ message: 'Статус изменён', id });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/projects/statuses/:id - удаление статуса, если в нём нет задач
router.delete('/statuses/:id', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор статуса' });
        }

        const result = await statusRepo.deleteStatus(id);
        if (!result.deleted) {
            return res.status(409).json({
                error: result.reason ?? 'Статус не найден'
            });
        }
        res.json({ message: 'Статус удалён', id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
