// test-pricing.js

const { calculateStickerOrder } = require("./netlify/functions/pricing-engine");

function test(width, height, quantity) {
  const result = calculateStickerOrder(width, height, quantity);

  if (!result) {
    console.log(`❌ ${width}x${height} @ ${quantity} → invalid`);
    return;
  }

  console.log(result);

  const totalCents =
    result.finalTotalCents ||
    result.total_cents ||
    result.totalCents ||
    0;

  const total = (totalCents / 100).toFixed(2);
  const unit = (totalCents / 100 / quantity).toFixed(2);

  console.log(
    `${width}"x${height}" @ ${quantity} → $${total} total ($${unit}/ea)`
  );
}

console.log("\n--- TESTING PRICING ENGINE ---\n");

test(3, 3, 100);
test(3, 3, 250);
test(3, 3, 500);
test(3, 3, 1000);

console.log("");

test(5, 5, 100);
test(5, 5, 250);
test(5, 5, 500);
test(5, 5, 1000);

console.log("");

test(6, 6, 100);
test(6, 6, 250);
test(6, 6, 500);
test(6, 6, 1000);

console.log("\n------------------------------\n");