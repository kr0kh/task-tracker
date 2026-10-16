// routes/authRoutes.js - маршруты регистрации и входа
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { loginRateLimit, registerFailedAttempt, resetAttempts } = require('../middleware/rateLimit');

// POST /api/auth/register - регистрация нового пользователя
router.post('/register', async (req, res, next) => {
    try {
        const { full_name, email, password } = req.body;

        // Валидация входных данных
        if (!full_name || !email || !password) {
            return res.status(400).json({ error: 'Укажите ФИО, email и пароль' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
        }

        // Проверка, что пользователь с таким email ещё не зарегистрирован
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?', [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Пароль хешируется перед сохранением - в открытом виде не хранится
        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [full_name, email, passwordHash, 'executor']
        );

        res.status(201).json({
            id: result.insertId,
            full_name,
            email,
            role: 'executor'
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/login - вход и выдача JWT-токена
// Ограничение частоты попыток стоит до обработчика: перебор пароля
// не доходит до обращения к базе данных
router.post('/login', loginRateLimit, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Укажите email и пароль' });
        }

        const [rows] = await pool.query(
            'SELECT id, full_name, email, password_hash, role FROM users WHERE email = ?',
            [email]
        );
        const user = rows[0];

        // Одинаковый ответ для несуществующего пользователя и неверного пароля
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            registerFailedAttempt(res.locals.rateLimitKey);
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Успешный вход сбрасывает счётчик неудачных попыток
        resetAttempts(res.locals.rateLimitKey);

        // В полезную нагрузку токена зашиваются id, email и роль
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
        );

        res.json({
            message: 'Успешная аутентификация',
            token,
            user: { id: user.id, full_name: user.full_name, role: user.role }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
