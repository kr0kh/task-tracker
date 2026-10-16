// middleware/validate.js - единая валидация входных данных
// Выделена в отдельный модуль, чтобы POST и PATCH использовали
// одни и те же проверки (раньше часть проверок была только в POST)

const PRIORITIES = ['low', 'medium', 'high'];
// Формат и реалистичность даты: месяц 01-12, день 01-31.
// Простая проверка формы (только \d{2}) пропускала '2100-99-99',
// а MySQL падал на несуществующем месяце с 500-й ошибкой
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Проверка одного числового поля-ссылки: целое число больше нуля.
// Возвращает текст ошибки или null
function idError(value, name) {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
        return `Неверное значение параметра ${name}`;
    }
    return null;
}

// GET /api/tasks - проверка фильтров списка
function taskQuery(req, res, next) {
    const checks = [
        ['projectId', req.query.projectId],
        ['statusId', req.query.statusId],
        ['assigneeId', req.query.assigneeId]
    ];
    for (const [name, value] of checks) {
        // Параметр необязателен: проверяется только если передан
        if (value !== undefined) {
            const err = idError(value, name);
            if (err) return res.status(400).json({ error: err });
        }
    }
    if (req.query.priority && !PRIORITIES.includes(req.query.priority)) {
        return res.status(400).json({
            error: 'Неверный приоритет: допустимо low, medium или high'
        });
    }
    next();
}

// PATCH /api/tasks/:id - проверка изменяемых полей
function taskPatchBody(req, res, next) {
    const { priority, due_date, project_id, status_id, assignee_id } = req.body;

    if (priority !== undefined && !PRIORITIES.includes(priority)) {
        return res.status(400).json({
            error: 'Приоритет должен быть low, medium или high'
        });
    }
    if (due_date !== undefined && due_date !== null && !DATE_RE.test(due_date)) {
        return res.status(400).json({
            error: 'Срок должен быть датой в формате ГГГГ-ММ-ДД'
        });
    }
    for (const [name, value] of [['project_id', project_id], ['status_id', status_id], ['assignee_id', assignee_id]]) {
        if (value !== undefined && value !== null) {
            const err = idError(value, name);
            if (err) return res.status(400).json({ error: err });
        }
    }
    next();
}

// POST /api/tasks - те же проверки для создания + обязательные поля
function taskPostBody(req, res, next) {
    const { project_id, status_id, title, priority, due_date, assignee_id } = req.body;

    if (!project_id || !status_id || !title) {
        return res.status(400).json({
            error: 'Обязательные поля: project_id, status_id, title'
        });
    }
    if (priority !== undefined && !PRIORITIES.includes(priority)) {
        return res.status(400).json({
            error: 'Приоритет должен быть low, medium или high'
        });
    }
    if (due_date !== undefined && due_date !== null && !DATE_RE.test(due_date)) {
        return res.status(400).json({
            error: 'Срок должен быть датой в формате ГГГГ-ММ-ДД'
        });
    }
    for (const [name, value] of [['project_id', project_id], ['status_id', status_id], ['assignee_id', assignee_id]]) {
        if (value !== undefined && value !== null) {
            const err = idError(value, name);
            if (err) return res.status(400).json({ error: err });
        }
    }
    next();
}

// GET /api/reports/* - проверка диапазона дат
function dateRange(req, res, next) {
    for (const name of ['from', 'to']) {
        if (req.query[name] !== undefined && !DATE_RE.test(req.query[name])) {
            return res.status(400).json({
                error: `Дата ${name} должна быть в формате ГГГГ-ММ-ДД`
            });
        }
    }
    next();
}

module.exports = { taskQuery, taskPatchBody, taskPostBody, dateRange };
