const { getPriceCents } = require("./netlify/functions/pricing-table");

console.log("3x3 @ 100 =", getPriceCents(3, 3, 100));
console.log("4x4 @ 100 =", getPriceCents(4, 4, 100));
console.log("5x5 @ 200 =", getPriceCents(5, 5, 200));
console.log("6x6 @ 500 =", getPriceCents(6, 6, 500));