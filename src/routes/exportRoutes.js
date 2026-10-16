// routes/exportRoutes.js - выгрузка данных в CSV
const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { assertProjectAccess } = require('../middleware/projectAccess');
const { toCsv } = require('../services/csv');

const router = express.Router();

// GET /api/tasks/export?projectId=1&statusId=2&format=csv
router.get('/tasks/export', authenticateToken, async (req, res, next) => {
    try {
        const projectId = Number(req.query.projectId);
        const format = (req.query.format || 'csv').toLowerCase();

        if (!projectId) {
            return res.status(400).json({ error: 'Не указан projectId' });
        }

        if (!['csv', 'json'].includes(format)) {
            return res.status(400).json({ error: 'Поддерживаются форматы csv и json' });
        }

        // Выгружать данные может только участник проекта
        if (!(await assertProjectAccess(req.user, projectId))) {
            return res.status(403).json({ error: 'Нет доступа к проекту' });
        }

        const where = ['t.project_id = ?'];
        const params = [projectId];

        if (req.query.statusId) {
            where.push('t.status_id = ?');
            params.push(Number(req.query.statusId));
        }

        const [rows] = await pool.query(
            `SELECT t.id, t.title, t.description, t.priority, t.due_date,
                    s.name AS status, u.full_name AS assignee, p.name AS project
             FROM tasks t
             JOIN statuses s ON s.id = t.status_id
             JOIN projects p ON p.id = t.project_id
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE ${where.join(' AND ')}
             ORDER BY t.id`,
            params
        );

        const columns = ['id', 'Название', 'Описание', 'Приоритет', 'Срок',
                         'Статус', 'Исполнитель', 'Проект'];

        // Дата приводится к виду ГГГГ-ММ-ДД: mysql2 возвращает объект Date,
        // и без приведения в файл попадала бы строка вида
        // "Tue Oct 20 2026 00:00:00 GMT+0300 (Moscow Standard Time)"
        const toDate = value => value
            ? new Date(value).toISOString().slice(0, 10)
            : '';

        const data = rows.map(row => [
            row.id, row.title, row.description, row.priority,
            toDate(row.due_date), row.status,
            row.assignee || 'не назначен', row.project
        ]);

        if (format === 'json') {
            return res.json({ total: data.length, items: data });
        }

        // Маркер BOM в начале файла: без него Excel показывает кириллицу нечитаемыми символами
        const csv = '\uFEFF' + toCsv(columns, data);
        const fileName = `tasks_project${projectId}_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        res.send(csv);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
