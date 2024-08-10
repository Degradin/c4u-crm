const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'users.json');

// Чтение данных из JSON-файла
const readData = () => {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        return JSON.parse(data);
    }
    return [];
};

// Запись данных в JSON-файл
const writeData = (data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Получение пользователя по telegramId
const getUser = (telegramId) => {
    const users = readData();
    return users.find(user => user.telegramId === telegramId);
};

// Добавление или обновление пользователя
const upsertUser = (telegramId, updateData) => {
    let users = readData();
    const index = users.findIndex(user => user.telegramId === telegramId);
    if (index !== -1) {
        // Обновляем существующего пользователя
        users[index] = { ...users[index], ...updateData };
    } else {
        // Добавляем нового пользователя
        users.push({ telegramId, ...updateData });
    }
    writeData(users);
};

module.exports = {
    getUser,
    upsertUser
};
