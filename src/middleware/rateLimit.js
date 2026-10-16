// middleware/rateLimit.js - ограничение числа попыток входа
// Хранилище в памяти подходит для одного экземпляра приложения;
// при горизонтальном масштабировании его заменяют на Redis
const attempts = new Map();

const MAX_ATTEMPTS = 5;          // не более 5 неудачных попыток
const WINDOW_MS = 15 * 60 * 1000; // в пределах 15 минут

function loginRateLimit(req, res, next) {
    const key = req.ip + '|' + (req.body.email || '');
    const now = Date.now();

    const record = attempts.get(key) ?? { count: 0, firstAt: now };

    // Окно истекло - счётчик начинается заново
    if (now - record.firstAt > WINDOW_MS) {
        record.count = 0;
        record.firstAt = now;
    }

    if (record.count >= MAX_ATTEMPTS) {
        const minutesLeft = Math.ceil((WINDOW_MS - (now - record.firstAt)) / 60000);
        return res.status(429).json({
            error: `Слишком много попыток входа. Повторите через ${minutesLeft} мин.`
        });
    }

    attempts.set(key, record);
    res.locals.rateLimitKey = key;  // ключ нужен обработчику для учёта результата
    next();
}

// Вызывается после проверки пароля: неудача увеличивает счётчик
function registerFailedAttempt(key) {
    const record = attempts.get(key);
    if (record) record.count += 1;
}

// Вызывается при успешном входе
function resetAttempts(key) {
    attempts.delete(key);
}

module.exports = { loginRateLimit, registerFailedAttempt, resetAttempts };
