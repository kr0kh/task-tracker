// scripts/checkApi.js - проверка эндпоинтов после развёртывания
// Адрес берётся из переменной BASE_URL: тот же скрипт проверяет
// и локальный сервер, и опубликованное приложение
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;

async function check(title, expectedStatus, request) {
    const response = await request();
    const ok = response.status === expectedStatus;
    ok ? passed++ : failed++;

    console.log(
        (ok ? 'OK   ' : 'ОШИБКА') + ' | ' + title +
        ' | ожидался ' + expectedStatus + ', получен ' + response.status
    );
}

async function main() {
    // 1. Проверка, что сервер запущен
    await check('GET /api/health', 200, () => fetch(BASE + '/api/health'));

    // 2. Вход и получение токена
    let token = null;
    await check('POST /api/auth/login (верный пароль)', 200, async () => {
        const response = await fetch(BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'manager@tracker.ru', password: 'manager123' })
        });
        token = (await response.clone().json()).token;
        return response;
    });

    // 3. Неверный пароль должен давать 401, а не 200
    await check('POST /api/auth/login (неверный пароль)', 401, () =>
        fetch(BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'manager@tracker.ru', password: 'неверный' })
        })
    );

    // 4. Защищённый эндпоинт без токена
    await check('GET /api/tasks без токена', 401, () => fetch(BASE + '/api/tasks'));

    // 5. Защищённый эндпоинт с токеном
    await check('GET /api/tasks с токеном', 200, () =>
        fetch(BASE + '/api/tasks', { headers: { 'Authorization': 'Bearer ' + token } })
    );

    // 6. Несуществующий идентификатор
    await check('GET /api/tasks/999999', 404, () =>
        fetch(BASE + '/api/tasks/999999', { headers: { 'Authorization': 'Bearer ' + token } })
    );

    // 7. Нечисловой идентификатор
    await check('GET /api/tasks/abc', 400, () =>
        fetch(BASE + '/api/tasks/abc', { headers: { 'Authorization': 'Bearer ' + token } })
    );

    console.log('\nПройдено: ' + passed + ', ошибок: ' + failed);
    if (failed > 0) process.exitCode = 1;
}

main().catch(err => { console.error('Ошибка:', err.message); process.exit(1); });
