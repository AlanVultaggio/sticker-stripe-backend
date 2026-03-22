// test-pricing.js

const { calculateStickerOrder } = require("./netlify/functions/pricing-engine");

// Toggle detailed object logging
const DEBUG = false;

// Full matrix sizes
const SIZES = [
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [8, 8],
  [10, 10],
  [12, 12],
];

// Full matrix quantities
const QUANTITIES = [25, 50, 100, 250, 500, 1000, 2500, 5000];

// Focused breakpoint tests using only live site quantities
const BREAKPOINT_CASES = [
  [4, 4, 250],
  [4, 4, 500],
  [4, 4, 1000],
  [4, 4, 2500],

  [5, 5, 250],
  [5, 5, 500],
  [5, 5, 1000],
  [5, 5, 2500],

  [6, 6, 250],
  [6, 6, 500],
  [6, 6, 1000],
  [6, 6, 2500],

  [8, 8, 250],
  [8, 8, 500],
  [8, 8, 1000],
  [8, 8, 2500],

  [10, 10, 250],
  [10, 10, 500],
  [10, 10, 1000],
  [10, 10, 2500],

  [12, 12, 100],
  [12, 12, 250],
  [12, 12, 500],
  [12, 12, 1000],
];

function formatMoneyFromCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function calculate(width, height, quantity) {
  const result = calculateStickerOrder(width, height, quantity);

  if (!result) return null;

  const totalCents =
    result.finalTotalCents ||
    result.total_cents ||
    result.totalCents ||
    0;

  const total = totalCents / 100;
  const unit = total / quantity;
  const rate = result.ratePerSqFt || 0;
  const areaSqFt = result.areaSqFt || 0;
  const totalSqFt = areaSqFt * quantity;

  return {
    width,
    height,
    quantity,
    totalCents,
    total,
    unit,
    rate,
    areaSqFt,
    totalSqFt,
    raw: result,
  };
}

function printRow(row) {
  const sizeLabel = `${row.width}"x${row.height}"`.padEnd(8);
  const qtyLabel = `@ ${String(row.quantity).padEnd(5)}`;
  const totalLabel = `| total: ${formatMoneyFromCents(row.totalCents).padEnd(10)}`;
  const unitLabel = `| per ea: $${row.unit.toFixed(2).padEnd(6)}`;
  const rateLabel = `| rate/sqft: ${row.rate.toFixed(2)}`;

  console.log(`${sizeLabel} ${qtyLabel} ${totalLabel} ${unitLabel} ${rateLabel}`);

  if (DEBUG) {
    console.log(row.raw);
  }
}

function printBreakpointRow(row) {
  const sizeLabel = `${row.width}"x${row.height}"`.padEnd(8);
  const qtyLabel = `@ ${String(row.quantity).padEnd(5)}`;
  const totalLabel = `| total: ${formatMoneyFromCents(row.totalCents).padEnd(10)}`;
  const unitLabel = `| per ea: $${row.unit.toFixed(2).padEnd(6)}`;
  const rateLabel = `| rate/sqft: ${row.rate.toFixed(2).padEnd(5)}`;
  const sqftLabel = `| total sqft: ${row.totalSqFt.toFixed(1).padEnd(6)}`;

  console.log(
    `${sizeLabel} ${qtyLabel} ${totalLabel} ${unitLabel} ${rateLabel} ${sqftLabel}`
  );

  if (DEBUG) {
    console.log(row.raw);
  }
}

function runFullMatrix() {
  console.log("\n==============================");
  console.log("   PRICING CURVE TEST MATRIX");
  console.log("==============================");

  for (const [w, h] of SIZES) {
    console.log(`\n===== ${w}" x ${h}" =====`);

    for (const q of QUANTITIES) {
      const row = calculate(w, h, q);

      if (!row) {
        console.log(`❌ ${w}"x${h}" @ ${q} → invalid`);
        continue;
      }

      printRow(row);
    }
  }

  console.log("\n✅ Matrix test complete.\n");
}

function runBreakpointFocus() {
  console.log("\n======================================");
  console.log("   BREAKPOINT / FLOOR FOCUS CHECK");
  console.log("======================================");

  const grouped = {};

  for (const [w, h, q] of BREAKPOINT_CASES) {
    const row = calculate(w, h, q);

    if (!row) {
      console.log(`❌ ${w}"x${h}" @ ${q} → invalid`);
      continue;
    }

    const key = `${w}" x ${h}"`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  for (const [section, rows] of Object.entries(grouped)) {
    console.log(`\n===== ${section} =====`);

    rows.sort((a, b) => a.quantity - b.quantity);

    let prevUnit = null;
    let prevRate = null;

    for (const row of rows) {
      printBreakpointRow(row);

      if (prevUnit !== null && prevRate !== null) {
        const unitDrop = (((prevUnit - row.unit) / prevUnit) * 100).toFixed(1);
        const rateDrop = (((prevRate - row.rate) / prevRate) * 100).toFixed(1);

        console.log(
          `         Δ from prior qty → per ea: ${unitDrop}% lower | rate/sqft: ${rateDrop}% lower`
        );
      }

      prevUnit = row.unit;
      prevRate = row.rate;
    }
  }

  console.log("\n✅ Breakpoint focus check complete.\n");
}

runFullMatrix();
runBreakpointFocus();