// src/config/index.js - чтение переменных окружения в одном месте
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });

// Если обязательная переменная не задана, приложение не запускается:
// иначе ошибка проявится позже и её причина будет неочевидна
const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];

for (const name of required) {
    if (!process.env[name]) {
        console.error(`Не задана переменная окружения ${name}. Проверьте файл .env`);
        process.exit(1);
    }
}

module.exports = {
    port: Number(process.env.PORT) || 3000,
    db: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '2h'
    }
};
