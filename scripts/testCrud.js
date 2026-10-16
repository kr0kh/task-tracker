// scripts/testCrud.js - проверка работы CRUD-функций без HTTP-маршрутов
require('dotenv').config();
const taskRepo = require('../src/repositories/taskRepository');
const pool = require('../src/db/pool');

async function main() {
    // CREATE
    const newId = await taskRepo.createTask({
        projectId: 1, statusId: 1, title: 'Тестовая задача',
        description: 'Проверка CRUD-функций', priority: 'medium',
        authorId: 2, assigneeId: 3
    });
    console.log('createTask -> вставлена задача с id =', newId);

    // READ
    const created = await taskRepo.getTaskById(newId);
    console.log('getTaskById ->', created.title, '| статус:', created.status_name);

    // UPDATE
    const updated = await taskRepo.updateTask(newId, { priority: 'high' });
    const afterUpdate = await taskRepo.getTaskById(newId);
    console.log('updateTask ->', updated, '| приоритет теперь:', afterUpdate.priority);

    // READ с несуществующим id - не должно быть исключения
    const missing = await taskRepo.getTaskById(999999);
    console.log('getTaskById(999999) ->', missing);

    // UPDATE с несуществующим id - false, а не ошибка
    const missingUpdate = await taskRepo.updateTask(999999, { title: 'нет такой' });
    console.log('updateTask(999999) ->', missingUpdate);

    // DELETE
    const deleted = await taskRepo.deleteTask(newId);
    console.log('deleteTask ->', deleted);

    // Повторное удаление - false
    const deletedAgain = await taskRepo.deleteTask(newId);
    console.log('deleteTask повторно ->', deletedAgain);

    await pool.end();
}

main().catch(err => { console.error('Ошибка:', err.message); process.exit(1); });
