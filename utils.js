function getLevelInfo(currentLevel, amount) {
    const newLevel = Math.floor(amount / 1000);
    let bonus = 0;
    let discount = 0
    if (currentLevel < 5) {
        bonus = Math.floor(amount * 0.01);
    } else if (currentLevel < 7) {
        bonus = Math.floor(amount * 0.05);
    } else if (currentLevel < 10) {
        bonus = Math.floor(amount * 0.06);
    } else if (currentLevel < 15) {
        bonus = Math.floor(amount * 0.08);
    } else {
        bonus = Math.floor(amount * 0.10);
    }

    switch (currentLevel){
        case 5:
            discount = 5
            break;
        case 7:
            discount = 7
            break;
        case 10:
            discount = 10
            break;
        case 15:
            discount = 15
            break;
        default:
            discount = 0
            break;
    }

    return { levelUp: newLevel, bonus, discount };
}

module.exports = {
    getLevelInfo
};
