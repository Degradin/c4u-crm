require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { MongoClient } = require('mongodb');
const { initializeDatabase, getUserByPhone, createUser, updateUser } = require('./database');
const { createCanvas, loadImage, registerFont  } = require('canvas');
const path = require('path');

const bot = new Telegraf(process.env.CLIENT_BOT_TOKEN);
let db;

const roles = {
    DEV: 'developer',
    ADMIN: 'admin',
    MANAGER: 'manager',
    CLIENT: 'client'
};

// Middleware to initialize session
bot.use(session());

// Middleware to initialize session data
bot.use(async (ctx, next) => {
    if (!ctx.session) {
        ctx.session = {};
    }
    if (ctx.from) {
        const user = await db.collection('users').findOne({ telegramId: ctx.from.id });
        if (user) {
            ctx.session.user = user;
        } else {
            ctx.session.user = null;
        }
    }
    return next();
});

// Команда /start для начала процесса авторизации
bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    if (!ctx.session.user) {
        ctx.reply('Пожалуйста, поделитесь своим номером телефона для авторизации.', {
            reply_markup: {
                keyboard: [
                    [{
                        text: "Отправить номер телефона",
                        request_contact: true,
                    }],
                ],
                one_time_keyboard: true,
                resize_keyboard: true,
            },
        });
    } else {
        ctx.reply('Вы уже авторизованы. Используйте меню ниже.', mainMenu());
    }
});

// Обработчик получения контакта
bot.on('contact', async (ctx) => {
    const chatId = ctx.chat.id;
    const phoneNumber = ctx.message.contact.phone_number;

    // Нормализуем номер телефона
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Проверяем, есть ли клиент в базе данных
    let user = await getUserByPhone(db, normalizedPhone);

    if (user) {
        // Если клиент найден, обновляем его telegramId
        await updateUser(db, user._id, { telegramId: ctx.from.id, authorized: true });
        ctx.session.user = user;
    } else {
        // Если клиент не найден, создаем нового пользователя
        user = await createUser(db, { phone: normalizedPhone, telegramId: ctx.from.id, role: roles.CLIENT, level: 1, bonusBalance: 0, authorized: true });
        ctx.session.user = user;
    }

    // Подтверждаем успешную авторизацию и показываем основное меню
    const message = 'Ваш номер телефона успешно сохранен и вы авторизованы.';
    const reply = await ctx.reply(message, Markup.keyboard(['💛 Профиль'], resize_keyboard, one_time_keyboard));
    ctx.session.messageId = reply.message_id;
});

// Функция нормализации номера телефона
function normalizePhoneNumber(phone) {
    phone = phone.replace(/[^0-9]/g, ''); // Удалить все нецифровые символы
    if (phone.startsWith('8')) {
        phone = '+7' + phone.slice(1); // Заменить 8 на +7
    } else if (phone.startsWith('7')) {
        phone = '+7' + phone.slice(1); // Заменить 7 на +7
    } else if (!phone.startsWith('+7')) {
        phone = '+7' + phone; // Добавить +7, если его нет
    }
    return phone;
}

// Основное меню с кнопками
function mainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('Профиль', 'profile')],
        [Markup.button.callback('Мои печати', 'my_stamps')],
        [Markup.button.callback('Настройки', 'settings')],
    ]);
}

bot.hears('💛 Профиль', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        const message = `Профиль:
📞 Телефон: ${user.phone}
📊 Уровень: ${user.level}
💰 Бонусный баланс: ${user.bonusBalance}`;

        await ctx.sendMessage(message, Markup.inlineKeyboard([
            [Markup.button.callback('Настройки', 'settings')],
            [Markup.button.callback('Мои печати', 'my_stamps')],
        ]));
    } else {
        ctx.reply('❌ Сначала авторизуйтесь.');
    }
});

// Обработчик кнопок меню
bot.action('profile', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        const message = `Профиль:
📞 Телефон: ${user.phone}
📊 Уровень: ${user.level}
💰 Бонусный баланс: ${user.bonusBalance}`;

        await ctx.editMessageText(message, Markup.inlineKeyboard([
            [Markup.button.callback('Настройки', 'settings')],
            [Markup.button.callback('Мои печати', 'my_stamps')],
        ]));
    } else {
        ctx.reply('❌ Сначала авторизуйтесь.');
    }
});

bot.action('settings', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        const subscriptionText = user.isSubscribedToAds ? 'Отключить подписку' : 'Включить подписку';
        await ctx.editMessageText(`Настройки:
📩 Подписка на рекламные сообщения: ${user.isSubscribedToAds ? 'Включена' : 'Отключена'}`, Markup.inlineKeyboard([
            [Markup.button.callback(subscriptionText, user.isSubscribedToAds ? 'unsubscribe_ads' : 'subscribe_ads')],
            [Markup.button.callback('Назад', 'profile')]
        ]));
    } else {
        ctx.reply('❌ Сначала авторизуйтесь.');
    }
});

// Обработка команды "Мои Печати"
bot.action('my_stamps', async (ctx) => {
    const user = await db.collection('users').findOne({ telegramId: ctx.from.id });
    if (!user) {
        return ctx.reply('❌ Пользователь не найден.');
    }

    const stamps = user.stamps || 0;

    const imageBuffer = await generateStampCard(stamps);
    await ctx.replyWithPhoto({ source: imageBuffer });
});

// Обработчики для включения и отключения подписки
bot.action('subscribe_ads', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        await updateUser(db, user._id, { isSubscribedToAds: true });
        await ctx.editMessageText('✅ Подписка на рекламные сообщения включена.', mainMenu());
    } else {
        ctx.reply('❌ Сначала авторизуйтесь.');
    }
});

bot.action('unsubscribe_ads', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        await updateUser(db, user._id, { isSubscribedToAds: false });
        await ctx.editMessageText('✅ Подписка на рекламные сообщения отключена.', mainMenu());
    } else {
        ctx.reply('❌ Сначала авторизуйтесь.');
    }
});

registerFont(path.join(__dirname, 'media/ShantellSans-Medium.ttf'), { family: 'ShantellSans-Medium' });

// Генерация изображения с печатями
async function generateStampCard(stamps) {
    
    const canvas = createCanvas(500, 300); // Размер изображения
    const ctx = canvas.getContext('2d');

    // Загрузка фона
    const background = await loadImage('./media/back.jpg');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // Полупрозрачный белый слой
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Рамка вокруг карты
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Заголовок
    ctx.fillStyle = '#000';
    ctx.font = '30px "ShantellSans-Medium"';
    ctx.textAlign = 'center';
    ctx.fillText('Ваши Печати', canvas.width / 2, 60);

    // Рисование печатей
    const stampImage = await loadImage('./media/stamp.png'); // Изображение печати

    for (let i = 0; i < 7; i++) {
        const x = 40 + i * 60;
        const y = 150;

        // Рамка для каждой печати
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, 50, 50);

        if (i < stamps) {
            ctx.drawImage(stampImage, x, y, 50, 50);
        }
    }

    // Текстовое описание количества печатей
    ctx.fillStyle = '#000';
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${stamps} / 7 Печатей`, canvas.width / 2, 250);

    return canvas.toBuffer();
}

// Запуск бота
bot.launch();

// Connect to MongoDB and start the bot
initializeDatabase(process.env.MONGODB_URI).then((database) => {
    db = database;
    console.log('Bot started successfully.');
}).catch((err) => {
    console.error('Failed to connect to the database:', err);
});
