const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

const SECRET_KEY = crypto.createHash('sha256').update(process.env.MANAGER_BOT_TOKEN).digest();

app.get('/auth', (req, res) => {
    const { hash, ...data } = req.query;
    const checkString = Object.keys(data).sort().map(k => (`${k}=${data[k]}`)).join('\n');
    const hmac = crypto.createHmac('sha256', SECRET_KEY).update(checkString).digest('hex');

    if (hmac !== hash) {
        return res.status(401).send('Unauthorized');
    }

    const userId = data.id;
    // Сохранение данных пользователя в сессии или базе данных

    res.redirect(`/dashboard?user_id=${userId}`);
});

app.get('/dashboard', async (req, res) => {
    const userId = req.query.user_id;
    
    // Загрузка данных пользователя из базы данных или API бота
    const userInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${userId}`);
    
    res.send(`
        <h1>Привет, ${userInfo.data.result.first_name}!</h1>
        <button onclick="window.location.href='/scan_qr'">Сканировать QR</button>
        <div id="bot-functions">
            <!-- Функции аналогичные вашему боту -->
        </div>
    `);
});

app.get('/scan_qr', (req, res) => {
    res.send(`
        <h1>Сканирование QR-кода</h1>
        <!-- Логика для сканирования QR-кода -->
    `);
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
