// server.js - точка входа приложения
const express = require('express');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commentRoutes = require('./routes/commentRoutes');
const labelTaskRoutes = require('./routes/labelTaskRoutes');
const projectRoutes = require('./routes/projectRoutes');
const labelRoutes = require('./routes/labelRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();

// Корневой адрес отдаёт страницу public/index.html со списком эндпоинтов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Маршруты API
app.use('/api/auth', authRoutes);
// Маршрут выгрузки объявлен до /api/tasks/:id, иначе строка "export"
// была бы воспринята как идентификатор задачи
app.use('/api', exportRoutes);              // /api/tasks/export
app.use('/api/tasks', taskRoutes);          // маршруты /api/tasks и /api/tasks/:id/status
app.use('/api/tasks', commentRoutes);       // /api/tasks/:id/comments
app.use('/api/tasks', labelTaskRoutes);     // /api/tasks/:id/labels
app.use('/api/projects', projectRoutes);    // проекты и статусы
app.use('/api', labelRoutes);               // /api/labels
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// Проверка, что приложение отвечает: используется скриптом npm run check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Несуществующий маршрут: раньше Node отдавал HTML-страницу «Cannot GET» -
// API обязано отвечать на любой запрос в формате JSON
app.use('/api', (req, res) => {
    res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

// Общий обработчик ошибок - обязательно последним
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});
