// netlify/functions/create-checkout.js

const Stripe = require("stripe");

// CORS: allow your Squarespace domain (and optional preview/test domains)
// If you want to allow any origin temporarily, set ALLOW_ALL_ORIGINS = true.
const ALLOW_ALL_ORIGINS = false;

const ALLOWED_ORIGINS = new Set([
  "https://www.unfoldingcreative.com",
  "https://unfoldingcreative.com",
  // Add a staging domain here if you have one, e.g.:
  // "https://staging.unfoldingcreative.com",
]);

function buildCorsHeaders(origin) {
  const allowOrigin =
    ALLOW_ALL_ORIGINS ? "*" : (ALLOWED_ORIGINS.has(origin) ? origin : "https://www.unfoldingcreative.com");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Helps prevent weird caching of CORS decisions
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(statusCode, headers, bodyObj) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(bodyObj),
  };
}

function pickNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = buildCorsHeaders(origin);

  // ✅ CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Friendly message for browser visits
  if (event.httpMethod !== "POST") {
    return json(200, headers, { message: "Use POST to create a Stripe Checkout session." });
  }

  // Ensure Stripe key exists
  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, headers, { error: "Missing STRIPE_SECRET_KEY env var in Netlify." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, headers, { error: "Invalid JSON body." });
  }

  // Accept BOTH payload formats:
  // A) flat: { width, height, quantity, total, jobName, upload_source }
  // B) nested: { order: {...}, pricing: { width_in, height_in, quantity, total_cents, unit_cents } }
  const pricing = data.pricing || {};
  const order = data.order || data;

  const width =
    pickNumber(data.width) ??
    pickNumber(pricing.width_in) ??
    pickNumber(order.width_in) ??
    pickNumber(order.width);

  const height =
    pickNumber(data.height) ??
    pickNumber(pricing.height_in) ??
    pickNumber(order.height_in) ??
    pickNumber(order.height);

  const quantity =
    pickNumber(data.quantity) ??
    pickNumber(pricing.quantity) ??
    pickNumber(order.quantity);

  // total can be either dollars (flat payload) or cents (nested payload)
  const totalDollars =
    pickNumber(data.total) ?? // dollars
    (pickNumber(pricing.total_cents) != null ? pickNumber(pricing.total_cents) / 100 : null);

  const jobName =
    (data.jobName || order.project_name || order.jobName || "").toString();

  const uploadSource =
    (data.upload_source || order.upload_source || "File Request Pro").toString();

  // Basic validation
  const missing = [];
  if (!width) missing.push("width");
  if (!height) missing.push("height");
  if (!quantity) missing.push("quantity");
  if (!totalDollars) missing.push("total");

  if (missing.length) {
    return json(400, headers, { error: `Missing field(s): ${missing.join(", ")}` });
  }

  // Convert total dollars to cents for Stripe
  const totalCents = Math.round(totalDollars * 100);

  if (totalCents < 50) {
    return json(400, headers, { error: "Total is too small." });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "required",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Custom Stickers",
              description: `${quantity} stickers — ${width} x ${height} in`,
            },
            // Stripe wants cents
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],

      metadata: {
        job_name: jobName,
        width: String(width),
        height: String(height),
        quantity: String(quantity),
        upload_source: uploadSource,
      },

      success_url: "https://www.unfoldingcreative.com/order-success",
      cancel_url: "https://www.unfoldingcreative.com/orderstickers",
    });

    return json(200, headers, { url: session.url });
  } catch (err) {
    return json(500, headers, { error: err?.message || "Stripe error" });
  }
};
