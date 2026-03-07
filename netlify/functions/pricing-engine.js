// netlify/functions/pricing-engine.js

const CONFIG = require("./pricing-config.json");

function isValidNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function getValidatedQuantity(quantity) {
  const qty = Number.parseInt(quantity, 10);
  const allowedQuantities = Object.keys(CONFIG.quantity_sqft_rates).map((q) =>
    Number.parseInt(q, 10)
  );

  if (!allowedQuantities.includes(qty)) {
    return null;
  }

  return qty;
}

function getBillableAreaSqIn(width, height) {
  const w = Number(width);
  const h = Number(height);

  if (!isValidNumber(w) || !isValidNumber(h)) {
    return null;
  }

  if (w < CONFIG.min_width || w > CONFIG.max_width) {
    return null;
  }

  if (h < CONFIG.min_height || h > CONFIG.max_height) {
    return null;
  }

  const actualArea = w * h;
  return Math.max(actualArea, CONFIG.minimum_billable_area_sq_in);
}

function getSqFtRate(quantity, billableAreaSqIn) {
  const baseRate = CONFIG.quantity_sqft_rates[String(quantity)];
  if (!baseRate) {
    return null;
  }

  let adjustedRate = baseRate;

  for (const rule of CONFIG.large_size_adjustments) {
    if (billableAreaSqIn >= rule.min_area_sq_in) {
      adjustedRate = baseRate * rule.multiplier;
    }
  }

  return adjustedRate;
}

function calculateStickerOrder(width, height, quantity) {
  const qty = getValidatedQuantity(quantity);
  if (!qty) {
    return null;
  }

  const billableAreaSqIn = getBillableAreaSqIn(width, height);
  if (!billableAreaSqIn) {
    return null;
  }

  const areaSqFt = billableAreaSqIn / 144;
  const ratePerSqFt = getSqFtRate(qty, billableAreaSqIn);
  if (!ratePerSqFt) {
    return null;
  }

  const rawTotal = areaSqFt * qty * ratePerSqFt;
  const finalTotalDollars = Math.max(rawTotal, CONFIG.minimum_order_dollars);
  const finalTotalCents = Math.round(finalTotalDollars * 100);

  return {
    width: Number(width),
    height: Number(height),
    quantity: qty,
    actualAreaSqIn: Number(width) * Number(height),
    billableAreaSqIn,
    areaSqFt,
    ratePerSqFt,
    finalTotalDollars,
    finalTotalCents
  };
}

module.exports = {
  calculateStickerOrder,
  getBillableAreaSqIn,
  getSqFtRate,
  getValidatedQuantity
};