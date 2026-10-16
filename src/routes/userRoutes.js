// routes/userRoutes.js - маршруты для сущности «Пользователь»
const express = require('express');
const router = express.Router();
const userRepo = require('../repositories/userRepository');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/users - список пользователей (admin)
router.get('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        res.json(await userRepo.getUsers());
    } catch (err) {
        next(err);
    }
});

// GET /api/users/me - данные текущего пользователя
// Объявлен до /:id, иначе строка "me" была бы воспринята как идентификатор
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const user = await userRepo.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/users/:id - изменение роли пользователя (admin)
router.patch('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный идентификатор пользователя' });
        }
        if (req.body.role && !['executor', 'manager', 'admin'].includes(req.body.role)) {
            return res.status(400).json({ error: 'Роль должна быть executor, manager или admin' });
        }

        const updated = await userRepo.updateUser(id, req.body);
        if (!updated) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(await userRepo.getUserById(id));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
