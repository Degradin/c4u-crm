require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { MongoClient } = require('mongodb');
const { initializeDatabase, getUserByPhone, createUser, updateUser } = require('./database');

const bot = new Telegraf(process.env.NOTIFY_BOT_TOKEN);
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
    ctx.reply('ChatID: ' + chatId);
});

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
            [Markup.button.callback('Мой QR', 'qr_code')],
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

// Запуск бота
bot.launch();

// Connect to MongoDB and start the bot
initializeDatabase(process.env.MONGODB_URI).then((database) => {
    db = database;
    console.log('Bot started successfully.');
}).catch((err) => {
    console.error('Failed to connect to the database:', err);
});
