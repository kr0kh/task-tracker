// middleware/errorHandler.js - общий обработчик необработанных исключений
// Ставится последним, после всех маршрутов
function errorHandler(err, req, res, next) {
    console.error(err.stack);

    // Ошибка целостности внешнего ключа (несуществующий project_id, status_id и т.п.)
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: 'Ссылка на несуществующую запись' });
    }
    // Нарушение ограничения UNIQUE (например, повторяющийся email)
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Такая запись уже существует' });
    }

    // Ответ всё равно в формате JSON, а не HTML-страница с трейсом
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}

module.exports = errorHandler;
