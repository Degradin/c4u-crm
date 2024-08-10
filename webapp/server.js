const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const userData = require('../userData');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));  // Установка пути к директории views
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const products = [
    { id: 1, name: 'Кофе', points: 100 },
    { id: 2, name: 'Чай', points: 50 },
    { id: 3, name: 'Круассан', points: 150 }
];

app.get('/', (req, res) => {
    const chatId = req.query.chatId || '';
    let userPoints = 0;

    if (chatId) {
        const user = userData.getUser(chatId);
        if (user) {
            userPoints = user.bonusBalance || 0;
        }
    }

    res.render('layout', { products, userPoints, chatId });
});

app.post('/buy', (req, res) => {
    const productId = req.body.productId;
    const product = products.find(p => p.id == productId);
    const chatId = req.body.chatId;

    if (product) {
        const user = userData.getUser(chatId);
        if (user && user.bonusBalance >= product.points) {
            user.bonusBalance -= product.points;
            user.totalSpent = (user.totalSpent || 0) + product.points;
            userData.upsertUser(chatId, user);

            axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: `🛒 Вы купили ${product.name} за ${product.points} баллов. Ваш текущий баланс: ${user.bonusBalance}.`
            }).then(() => {
                res.send('Покупка успешно совершена');
            }).catch(() => {
                res.status(500).send('Ошибка при отправке уведомления');
            });
        } else {
            res.status(400).send('Недостаточно баллов или пользователь не найден');
        }
    } else {
        res.status(400).send('Ошибка при совершении покупки');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
