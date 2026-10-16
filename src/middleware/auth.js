// middleware/auth.js - проверка JWT-токена и разграничение прав
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Ожидаемый формат заголовка: Authorization: Bearer <токен>
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Не авторизован: токен отсутствует' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(401).json({ error: 'Недействительный или истёкший токен' });
        }
        req.user = payload;  // { id, email, role }
        next();
    });
}

// Middleware проверки роли (разграничение прав доступа)
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole };
