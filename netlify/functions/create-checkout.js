// netlify/functions/create-checkout.js

const Stripe = require("stripe");

const ALLOWED_ORIGINS = new Set([
  "https://unfoldingcreative.com",
  "https://www.unfoldingcreative.com",
]);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://www.unfoldingcreative.com"; // safe default

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(statusCode, headers, obj) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(obj),
  };
}

// Accept BOTH payload shapes:
// A) { width, height, quantity, total, jobName, upload_source }
// B) { order: {...}, pricing: { width_in, height_in, quantity, total_cents, unit_cents } }
function normalizePayload(body) {
  const data = typeof body === "string" ? JSON.parse(body || "{}") : (body || {});

  // Shape B (nested)
  if (data.pricing && typeof data.pricing === "object") {
    const p = data.pricing;
    const width = Number(p.width_in);
    const height = Number(p.height_in);
    const quantity = Number(p.quantity);
    const total_cents = Number(p.total_cents);

    const jobName =
      (data.order && (data.order.project_name || data.order.jobName)) || data.jobName || "";

    const upload_source =
      (data.order && data.order.upload_source) || data.upload_source || "File Request Pro";

    return { width, height, quantity, total_cents, jobName, upload_source };
  }

  // Shape A (top-level)
  const width = Number(data.width);
  const height = Number(data.height);
  const quantity = Number(data.quantity);

  // total may be dollars (number) OR you might send cents later
  const total_dollars = data.total != null ? Number(data.total) : null;
  const total_cents =
    data.total_cents != null
      ? Number(data.total_cents)
      : total_dollars != null
        ? Math.round(total_dollars * 100)
        : null;

  const jobName = data.jobName || data.project_name || "";
  const upload_source = data.upload_source || "File Request Pro";

  return { width, height, quantity, total_cents, jobName, upload_source };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || "";
  const headers = corsHeaders(origin);

  // ✅ Preflight must return headers
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Friendly message if visited in browser
  if (event.httpMethod !== "POST") {
    return json(200, headers, { message: "Use POST to create a Stripe Checkout session." });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(500, headers, { error: "Missing STRIPE_SECRET_KEY in Netlify environment." });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { width, height, quantity, total_cents, jobName, upload_source } =
      normalizePayload(event.body);

    // Basic validation
    const required = { width, height, quantity, total_cents };
    for (const [k, v] of Object.entries(required)) {
      if (!Number.isFinite(v) || v <= 0) {
        return json(400, headers, { error: `Missing/invalid field: ${k}` });
      }
    }

    // Create a single line item where unit_amount is the total (qty 1)
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
              description: `${quantity} stickers — ${width}x${height} in`,
            },
            unit_amount: Math.round(total_cents),
          },
          quantity: 1,
        },
      ],
      metadata: {
        job_name: jobName || "",
        width: String(width),
        height: String(height),
        quantity: String(quantity),
        upload_source: upload_source || "File Request Pro",
      },
      success_url: "https://www.unfoldingcreative.com/order-success",
      cancel_url: "https://www.unfoldingcreative.com/orderstickers",
    });

    return json(200, headers, { url: session.url });
  } catch (err) {
    return json(500, headers, { error: err?.message || "Stripe error" });
  }
};
