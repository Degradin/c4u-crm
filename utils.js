function getLevelInfo(currentLevel, amount) {
    const newLevel = Math.floor(amount / 1000);
    let bonus = 0;
    if (currentLevel < 5) {
        bonus = amount * 0.01;
    } else if (currentLevel < 7) {
        bonus = amount * 0.05;
    } else if (currentLevel < 10) {
        bonus = amount * 0.06;
    } else if (currentLevel < 15) {
        bonus = amount * 0.08;
    } else {
        bonus = amount * 0.10;
    }
    return { levelUp: newLevel, bonus };
}

module.exports = {
    getLevelInfo
};
