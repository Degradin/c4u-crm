const { MongoClient, ObjectId } = require('mongodb');

async function initializeDatabase(uri) {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db('c4u-crm');
    return db;
}

async function getUserByPhone(db, phone) {
    return await db.collection('users').findOne({ phone });
}

async function createUser(db, user) {
    return await db.collection('users').insertOne(user);
}

async function updateUser(db, userId, update) {
    return await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: update });
}

async function createOrder(db, userId, amount, bonus) {
    return await db.collection('orders').insertOne({ userId: new ObjectId(userId), amount, bonus, date: new Date() });
}

async function getUserOrders(db, userId) {
    return await db.collection('orders').find({ userId: new ObjectId(userId) }).toArray();
}

module.exports = {
    initializeDatabase,
    getUserByPhone,
    createUser,
    updateUser,
    createOrder,
    getUserOrders
};
