// netlify/functions/pricing-table.js

const PRICING_CURVES = require("./pricing-curves.json");

// Allowed order quantities
const ALLOWED_QUANTITIES = [25, 50, 100, 200, 300, 500, 1000];

// Pricing table (total order price in cents)
const PRICING_TABLE = {
  small: {
    25: 2900,
    50: 3900,
    100: 5900,
    200: 8900,
    300: 11900,
    500: 15900,
    1000: 25900
  },

  medium: {
    25: 3500,
    50: 4700,
    100: 6900,
    200: 9900,
    300: 12900,
    500: 17900,
    1000: 29900
  },

  large: {
    25: 4500,
    50: 5900,
    100: 8500,
    200: 11900,
    300: 14900,
    500: 21900,
    1000: 35900
  },

  xlarge: {
    25: 5900,
    50: 7900,
    100: 10900,
    200: 15900,
    300: 19900,
    500: 29900,
    1000: 45900
  }
};

// Determine size tier from sticker dimensions
function getSizeTier(width, height) {
  const w = Number(width);
  const h = Number(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }

  const maxSide = Math.max(w, h);

  if (maxSide <= 3) return "3x3";
  if (maxSide <= 4) return "4x4";
  if (maxSide <= 5) return "5x5";
  return "6x6";
}

// Look up order total from table
function getPriceCents(width, height, quantity) {
  const qty = Number.parseInt(quantity, 10);

  if (!ALLOWED_QUANTITIES.includes(qty)) {
    return null;
  }

  const sizeTier = getSizeTier(width, height);
  if (!sizeTier) {
    return null;
  }

const priceDollars = PRICING_CURVES[sizeTier]?.[qty];
if (!priceDollars) return null;

return Math.round(priceDollars * 100);
}

module.exports = {
  ALLOWED_QUANTITIES,
  PRICING_TABLE,
  getSizeTier,
  getPriceCents
};