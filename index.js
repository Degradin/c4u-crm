require('dotenv').config();
const { Telegraf, Markup, Scenes, session } = require('telegraf');
const { MongoClient, ObjectId } = require('mongodb');
const { initializeDatabase, getUserByPhone, createUser, updateUser, createOrder, getUserOrders } = require('./database');
const { getLevelInfo } = require('./utils');

const bot = new Telegraf(process.env.BOT_TOKEN);
let db;

const roles = {
    DEVELOPER: 'developer',
    ADMIN: 'admin',
    MANAGER: 'manager',
    CLIENT: 'client'
};

// Middleware to check user's role
bot.use(async (ctx, next) => {
    if (ctx.from) {
        const user = await db.collection('users').findOne({ telegramId: ctx.from.id });
        ctx.state.role = user ? user.role : roles.CLIENT;
    }
    return next();
});


// Сцены
const registerScene = new Scenes.WizardScene(
    'register',
    async (ctx) => {
        ctx.reply('📞 Введите номер телефона клиента.', Markup.keyboard([['❌ Отмена']]).oneTime().resize());
        ctx.wizard.state.data = {};
        return ctx.wizard.next();
    },
    async (ctx) => {
        const phone = ctx.message.text;
        if (phone === '❌ Отмена') {
            ctx.reply('❌ Регистрация отменена.', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        }
        let user = await getUserByPhone(db, phone);
        if (!user) {
            await createUser(db, { phone, telegramId: null, role: 'client', level: 1, bonusBalance: 0 });
            ctx.reply('✅ Клиент успешно зарегистрирован. Введите сумму заказа.', Markup.keyboard([['❌ Отмена']]).oneTime().resize());
            ctx.wizard.state.data.phone = phone;
            return ctx.wizard.next();
        } else {
            ctx.reply('⚠️ Клиент уже зарегистрирован.', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        }
    },
    async (ctx) => {
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            ctx.reply('❌ Неверная сумма. Введите правильное число.');
            return;
        }
        const phone = ctx.wizard.state.data.phone;
        const user = await getUserByPhone(db, phone);
        const levelInfo = getLevelInfo(user.level, amount);
        await createOrder(db, user._id, amount, levelInfo.bonus);
        await updateUser(db, user._id, { level: user.level + levelInfo.levelUp, bonusBalance: user.bonusBalance + levelInfo.bonus });
        ctx.reply(`✅ Заказ успешно создан. Новый уровень клиента: ${user.level + levelInfo.levelUp}, бонусный баланс: ${user.bonusBalance + levelInfo.bonus}`, Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
        return ctx.scene.leave();
    }
);

// Сцена для создания заказа
const orderScene = new Scenes.WizardScene(
    'order',
    async (ctx) => {
        ctx.reply('📞 Введите номер телефона клиента.', Markup.keyboard([['❌ Отмена']]).oneTime().resize());
        ctx.wizard.state.data = {};
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            ctx.reply('❌ Неверные данные. Введите номер телефона снова.');
            return;
        }
        const phone = ctx.message.text;
        if (phone === '❌ Отмена') {
            ctx.reply('❌ Создание заказа отменено.', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        }
        const user = await getUserByPhone(db, phone);
        if (user) {
            ctx.wizard.state.data.userId = user._id;
            ctx.reply('Введите сумму заказа.', Markup.keyboard([['❌ Отмена']]).oneTime().resize());
            return ctx.wizard.next();
        } else {
            ctx.reply('❌ Клиент не найден.', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        }
    },
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            ctx.reply('❌ Неверные данные. Введите сумму заказа снова.');
            return;
        }
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            ctx.reply('❌ Неверная сумма. Введите правильное число.');
            return;
        }
        const userId = ctx.wizard.state.data.userId;
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        const levelInfo = getLevelInfo(user.level, amount);
        await createOrder(db, user._id, amount, levelInfo.bonus);
        await updateUser(db, user._id, { level: user.level + levelInfo.levelUp, bonusBalance: user.bonusBalance + levelInfo.bonus });
        ctx.reply(`✅ Заказ успешно создан. Новый уровень клиента: ${user.level + levelInfo.levelUp}, бонусный баланс: ${user.bonusBalance + levelInfo.bonus}`, Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
        return ctx.scene.leave();
    }
);

const viewClientInfoScene = new Scenes.WizardScene(
    'viewClientInfo',
    async (ctx) => {
        ctx.reply('📞 Введите номер телефона клиента.', Markup.keyboard([['❌ Отмена']]).oneTime().resize());
        ctx.wizard.state.data = {};
        return ctx.wizard.next();
    },
    async (ctx) => {
        const phone = ctx.message.text;
        if (phone === '❌ Отмена') {
            ctx.reply('❌ Получение информации о клиенте отменено.', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        }
        const user = await getUserByPhone(db, phone);
        if (user) {
            const orders = await getUserOrders(db, user._id);
            const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
            const message = `Информация о клиенте:
📞 Телефон: ${user.phone}
📊 Уровень: ${user.level}
💰 Бонусный баланс: ${user.bonusBalance}
💸 Всего потрачено: ${totalAmount}`;
            ctx.reply(message, Markup.inlineKeyboard([
                Markup.button.callback('🛒 Создать заказ', `create_order_${user._id}`)
            ]));
            ctx.reply('Выберите действие:', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        } else {
            ctx.reply('❌ Клиент не найден.', Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize());
            return ctx.scene.leave();
        }
    }
);

// Обработчик кнопки "Создать заказ" в информации о клиенте
bot.action(/create_order_(.+)/, (ctx) => {
    const userId = ctx.match[1];
    if (ctx.scene) {
        ctx.scene.enter('order', { userId });
    } else {
        ctx.reply('❌ Ошибка. Попробуйте снова.');
    }
});

const stage = new Scenes.Stage([registerScene, orderScene, viewClientInfoScene]);
bot.use(session());
bot.use(stage.middleware());

const mainMenu = Markup.keyboard([['👥 Зарегистрировать клиента', '🛒 Создать заказ', '🔍 Информация о клиенте']]).resize();

bot.start((ctx) => ctx.reply('Добро пожаловать! Выберите действие:', mainMenu));

bot.hears('👥 Зарегистрировать клиента', (ctx) => {
    if (['developer', 'admin', 'manager'].includes(ctx.state.role)) {
        ctx.scene.enter('register');
    } else {
        ctx.reply('❌ У вас нет прав на регистрацию клиентов.', mainMenu);
    }
});

bot.hears('🛒 Создать заказ', (ctx) => {
    if (['developer', 'admin', 'manager'].includes(ctx.state.role)) {
        ctx.scene.enter('order');
    } else {
        ctx.reply('❌ У вас нет прав на создание заказов.', mainMenu);
    }
});

bot.hears('🔍 Информация о клиенте', (ctx) => {
    if (['developer', 'admin', 'manager'].includes(ctx.state.role)) {
        ctx.scene.enter('viewClientInfo');
    } else {
        ctx.reply('❌ У вас нет прав на просмотр информации о клиенте.', mainMenu);
    }
});

// Connect to MongoDB and start the bot
initializeDatabase(process.env.MONGODB_URI).then((database) => {
    db = database;
    bot.launch();
    console.log('Bot started successfully.');
}).catch((err) => {
    console.error('Failed to connect to the database:', err);
});

