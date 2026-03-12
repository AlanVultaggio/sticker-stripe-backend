const { calculateStickerOrder } = require("./netlify/functions/pricing-engine");

console.log("1x1 @ 25 =", calculateStickerOrder(1, 1, 25));
console.log("3x3 @ 100 =", calculateStickerOrder(3, 3, 100));
console.log("4x4 @ 250 =", calculateStickerOrder(4, 4, 250));
console.log("16x24 @ 25 =", calculateStickerOrder(16, 24, 25));
console.log("25x25 @ 100 =", calculateStickerOrder(25, 25, 100));