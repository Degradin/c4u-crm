require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { MongoClient } = require('mongodb');
const { initializeDatabase, getUserByPhone, createUser, updateUser, createOrder, getUserOrders } = require('./database');
const { getLevelInfo } = require('./utils');
const winston = require('winston');

const bot = new Telegraf(process.env.MANAGER_BOT_TOKEN);
let db;
let accessLevel = 'system';
let managerID = 0;

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
        ctx.state.role = user ? user.role : roles.CLIENT;
        accessLevel = ctx.state.role
        managerID = ctx.from.id
    }
    if(ctx.state.role == roles.CLIENT) return ctx.sendMessage('No Permission!')
    return next();
});

// Setup logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}] [${accessLevel}] [${managerID}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bot.log' })
    ]
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

// Проверка номера телефона
const phoneNumberPattern = /^(?:\+7|8|7)\d{10}$/;

// Обработка сообщений с номером телефона
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    logger.info(`Received text message: ${text}`);

    if (phoneNumberPattern.test(text)) {
        // Проверка номера телефона
        const phone = normalizePhoneNumber(text);
        logger.info(`Normalized phone number: ${phone}`);

        // Проверяем, есть ли клиент в базе данных
        const user = await getUserByPhone(db, phone);
        if (user) {
            // Клиент найден
            ctx.session.user = user;  // Устанавливаем пользователя в сессии
            const orders = await getUserOrders(db, user._id);
            const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
            const message = `Информация о клиенте:
*️⃣ Статус: ${user.role}  [${user.authorized ? '🔵' : '⚫'}]
📞 Телефон: ${user.phone}
📊 Уровень: ${user.level}
💰 Бонусный баланс: ${user.bonusBalance}
💸 Всего потрачено: ${totalAmount}
🧾 Печатей: ${user.stamps}
📩 Рассылка разрешена? - ${user.isSubscribedToAds ? 'Да' : "Нет"}`;

            const buttons = [
                [Markup.button.callback('💳 Создать заказ', 'create_order')],
                [Markup.button.callback('🖋️ Поставить печать', 'add_stamp')],
                (user.stamps >= 7 ? [Markup.button.callback('🎁 Обменять на напиток', 'redeem_reward')] : [])
            ];

            await ctx.reply(message, Markup.inlineKeyboard(buttons));
            logger.info(`Sent client info message for phone: ${phone}`);
        } else {
            // Клиент не найден
            ctx.reply('❓ Клиент не найден. Желаете зарегистрировать нового клиента?', Markup.inlineKeyboard([
                [Markup.button.callback('Да', 'register_yes')],
                [Markup.button.callback('Нет', 'register_no')]
            ]));
            ctx.session.phone = phone;
            logger.info(`Client not found. Phone number: ${phone}`);
        }
    } else if (ctx.session.user) {
        // Обработка суммы заказа
        const amount = parseFloat(text);
        if (!isNaN(amount)) {
            const user = ctx.session.user;
            const levelInfo = getLevelInfo(user.level, amount);
            await createOrder(db, user._id, amount, levelInfo.bonus);
            await updateUser(db, user._id, {
                level: user.level + levelInfo.levelUp,
                bonusBalance: user.bonusBalance + levelInfo.bonus,
                discount: levelInfo.discount
            });
            ctx.reply(`✅ Заказ успешно создан. Новый уровень клиента: ${user.level + levelInfo.levelUp}, бонусный баланс: ${user.bonusBalance + levelInfo.bonus}`);
            ctx.session.user = null; // Очистить данные о текущем клиенте
            logger.info(`Order created for user: ${user.phone}. Amount: ${amount}`);
        } else {
            ctx.reply('❌ Неверная сумма. Пожалуйста, введите правильное число.');
            logger.warn(`Invalid amount input: ${text}`);
        }
    } else {
        ctx.reply('❌ Пожалуйста, введите корректный номер телефона.');
    }
});

// Обработка callback-кнопок
bot.action('register_yes', async (ctx) => {
    // Регистрация нового клиента
    const phone = ctx.session.phone;
    if (phone) {
        await createUser(db, { phone, telegramId: ctx.from.id, role: 'client', level: 1, bonusBalance: 0, stamps: 0, authorized: false });
        const message = '✅ Клиент успешно зарегистрирован. Введите сумму заказа.';
        ctx.session.user = await getUserByPhone(db, phone);
        ctx.session.phone = null; // Очистить номер телефона

        if (ctx.session.messageId) {
            await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.messageId, null, message);
        } else {
            const sentMessage = await ctx.reply(message);
            ctx.session.messageId = sentMessage.message_id;
        }
        logger.info(`Client registered: ${phone}`);
    } else {
        ctx.reply('❌ Возникла ошибка. Пожалуйста, повторите попытку.');
        logger.error('Error occurred during client registration.');
    }
});

bot.action('register_no', (ctx) => {
    const message = '❌ Регистрация отменена.';
    if (ctx.session.messageId) {
        ctx.telegram.editMessageText(ctx.chat.id, ctx.session.messageId, null, message, Markup.inlineKeyboard([
            [Markup.button.callback('💳 Создать заказ', 'create_order')],
            [Markup.button.callback('🔍 Информация о клиенте', 'client_info')]
        ]));
    } else {
        ctx.reply(message, Markup.inlineKeyboard([
            [Markup.button.callback('💳 Создать заказ', 'create_order')],
            [Markup.button.callback('🔍 Информация о клиенте', 'client_info')]
        ]));
    }
    ctx.session.phone = null; // Очистить номер телефона
    logger.info('Client registration cancelled.');
});

bot.action('create_order', (ctx) => {
    if (ctx.session.user) {
        ctx.reply('Введите сумму заказа.');
        logger.info('Requesting order amount.');
    } else {
        ctx.reply('❌ Сначала введите номер телефона клиента.');
        logger.warn('Order creation attempted without phone number.');
    }
});

bot.action('add_stamp', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        const newStamps = Number(user.stamps + 1);
        await updateUser(db, user._id, { stamps: Number(newStamps) });
        user.stamps = newStamps;

        const message = `[${Date.now()}]🧾 Печать добавлена. Теперь у клиента ${newStamps} печатей.`;
        const buttons = [
            [Markup.button.callback('💳 Создать заказ', 'create_order')],
            [Markup.button.callback('🖋️ Поставить печать', 'add_stamp')],
            (newStamps >= 7 ? [Markup.button.callback('🎁 Обменять на напиток', 'redeem_reward')] : [])
        ];

        await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
        logger.info(`Stamp added. Total stamps: ${newStamps}`);
    } else {
        ctx.reply('❌ Сначала введите номер телефона клиента.');
        logger.warn('Stamp addition attempted without phone number.');
    }
});

bot.action('redeem_reward', async (ctx) => {
    const user = ctx.session.user;
    if (user) {
        await updateUser(db, user._id, { stamps: user.stamps - 7 }); // Сбрасываем печати
        ctx.reply(`[${Date.now()}] 🎉 Обмен произведен! Печати сброшены.`);
        user.stamps -= 7;
        const message = 'Печати были сброшены.';
        const buttons = [
            [Markup.button.callback('💳 Создать заказ', 'create_order')],
            [Markup.button.callback('🖋️ Поставить печать', 'add_stamp')],
            [Markup.button.callback('🔍 Информация о клиенте', 'client_info')]
        ];

        await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
        logger.info('Reward redeemed. Stamps reset. ' + Date.now());
    } else {
        ctx.reply('❌ Сначала введите номер телефона клиента.');
        logger.warn('Reward redemption attempted without phone number.');
    }
});

bot.action('client_info', async (ctx) => {
    if (ctx.session.user) {
        const user = ctx.session.user;
        const orders = await getUserOrders(db, user._id);
        const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
        const message = `Информация о клиенте:
📞 Телефон: ${user.phone}
📊 Уровень: ${user.level}
💰 Бонусный баланс: ${user.bonusBalance}
💸 Всего потрачено: ${totalAmount}
🧾 Печатей: ${user.stamps}`;

        const buttons = [
            [Markup.button.callback('💳 Создать заказ', 'create_order')],
            [Markup.button.callback('🖋️ Поставить печать', 'add_stamp')],
            (user.stamps >= 7 ? [Markup.button.callback('🎁 Обменять на напиток', 'redeem_reward')] : [])
        ];

        await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
        logger.info('Client info requested.');
    } else {
        ctx.reply('❌ Сначала введите номер телефона клиента.');
        logger.warn('Client info requested without phone number.');
    }
});

bot.launch();

// Connect to MongoDB and start the bot
initializeDatabase(process.env.MONGODB_URI).then((database) => {
    db = database;
    logger.info('Bot started successfully.');
}).catch((err) => {
    logger.error('Failed to connect to the database:', err);
});
