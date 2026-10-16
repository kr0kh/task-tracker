// routes/reportRoutes.js - отчёты по нагрузке, эффективности и срокам
const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { dateRange } = require('../middleware/validate');

const router = express.Router();

// GET /api/reports/workload?from=2026-10-01&to=2026-10-31&projectId=1
// Формат дат проверяет middleware dateRange: без него MySQL молча сравнивал
// бы строку 'не-дата' с датой и возвращал пустой отчёт вместо ошибки
router.get('/workload', authenticateToken, requireRole('manager', 'admin'), dateRange, async (req, res, next) => {
    try {
        const conditions = [];
        const params = [];

        // Период подставляется параметрами, а не конкатенацией строк
        if (req.query.from) {
            conditions.push('t.created_at >= ?');
            params.push(req.query.from);
        }

        if (req.query.to) {
            conditions.push('t.created_at <= ?');
            params.push(req.query.to + ' 23:59:59');
        }

        if (req.query.projectId) {
            conditions.push('t.project_id = ?');
            params.push(Number(req.query.projectId));
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const [rows] = await pool.query(
            `SELECT u.id, u.full_name,
                    COUNT(t.id) AS total_tasks,
                    SUM(CASE WHEN s.name = 'Готово' THEN 1 ELSE 0 END) AS done_tasks,
                    SUM(CASE WHEN t.priority = 'high' THEN 1 ELSE 0 END) AS high_priority_tasks,
                    SUM(CASE WHEN t.due_date < CURDATE() AND s.name <> 'Готово'
                             THEN 1 ELSE 0 END) AS overdue
             FROM users u
             JOIN tasks t ON t.assignee_id = u.id
             JOIN statuses s ON s.id = t.status_id
             ${where}
             GROUP BY u.id, u.full_name
             ORDER BY total_tasks DESC`,
            params
        );

        // Процент закрытых задач считается в приложении: SQL возвращает уже сгруппированные строки
        const items = rows.map(row => ({
            id: row.id,
            fullName: row.full_name,
            totalTasks: row.total_tasks,
            doneTasks: row.done_tasks,
            highPriority: row.high_priority_tasks,
            overdue: row.overdue,
            donePercent: row.total_tasks
                ? Math.round((row.done_tasks / row.total_tasks) * 100)
                : 0
        }));

        res.json({
            period: { from: req.query.from || null, to: req.query.to || null },
            totalExecutors: items.length,
            items
        });
    } catch (err) {
        next(err);
    }
});

// Показатели считаются по каждой задаче, затем усредняются по проекту:
// срок выполнения в днях и отклонение фактического срока от планового.
router.get('/performance', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
    try {
        const params = [];
        let projectFilter = '';

        if (req.query.projectId) {
            projectFilter = 'WHERE t.project_id = ?';
            params.push(Number(req.query.projectId));
        }

        const [rows] = await pool.query(
            `SELECT p.id, p.name,
                    COUNT(t.id) AS total_tasks,
                    SUM(CASE WHEN s.name = 'Готово' THEN 1 ELSE 0 END) AS done_tasks,
                    ROUND(AVG(CASE WHEN s.name = 'Готово'
                                   THEN DATEDIFF(t.closed_at, t.created_at) END), 1) AS avg_days,
                    ROUND(AVG(CASE WHEN s.name = 'Готово' AND t.closed_at IS NOT NULL
                                   THEN DATEDIFF(t.closed_at, t.due_date) END), 1) AS avg_delay_days,
                    SUM(CASE WHEN s.name = 'Готово' AND t.closed_at > t.due_date
                             THEN 1 ELSE 0 END) AS done_late
             FROM projects p
             JOIN tasks t ON t.project_id = p.id
             JOIN statuses s ON s.id = t.status_id
             ${projectFilter}
             GROUP BY p.id, p.name
             ORDER BY avg_days IS NULL, avg_days`,
            params
        );

        const items = rows.map(row => ({
            id: row.id,
            name: row.name,
            totalTasks: row.total_tasks,
            doneTasks: row.done_tasks,
            avgDays: row.avg_days,
            avgDelayDays: row.avg_delay_days,
            doneLate: row.done_late,
            donePercent: row.total_tasks
                ? Math.round((row.done_tasks / row.total_tasks) * 100)
                : 0
        }));

        res.json({ totalProjects: items.length, items });
    } catch (err) {
        next(err);
    }
});

// Для каждой задачи возвращается дата создания, плановый срок и дата закрытия,
// по которым в отчёте строится диаграмма выполнения.
router.get('/timeline', authenticateToken, async (req, res, next) => {
    try {
        const projectId = Number(req.query.projectId);

        // Раньше projectId=abc давал NaN и попадал в ветку «не указан»:
        // сообщение не соответствовало причине ошибки
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return res.status(400).json({ error: 'Не указан или неверный projectId' });
        }

        const [rows] = await pool.query(
            `SELECT t.id, t.title, t.created_at, t.due_date, t.closed_at,
                    s.name AS status, u.full_name AS assignee,
                    DATEDIFF(IFNULL(t.closed_at, CURDATE()), t.created_at) AS days_in_work,
                    DATEDIFF(IFNULL(t.closed_at, CURDATE()), t.due_date) AS delay_days
             FROM tasks t
             JOIN statuses s ON s.id = t.status_id
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.project_id = ?
             ORDER BY t.created_at`,
            [projectId]
        );

        res.json({ total: rows.length, items: rows });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
