// netlify/functions/create-checkout.js

const Stripe = require("stripe");

const ALLOWED_ORIGINS = new Set([
  "https://www.unfoldingcreative.com",
  "https://unfoldingcreative.com",
]);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.unfoldingcreative.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = corsHeaders(origin);

  // ✅ Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Friendly message if someone visits in browser
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Use POST to create a Stripe Checkout session." }),
    };
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing STRIPE_SECRET_KEY in Netlify environment variables." }),
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const data = JSON.parse(event.body || "{}");

    // Accept BOTH payload shapes:
    // A) { width, height, quantity, total }  (your older/simple shape)
    // B) { order: {...}, pricing: { width_in, height_in, quantity, total_cents, unit_cents } } (your newer shape)

    const width =
      data.width ??
      data.pricing?.width_in ??
      data.pricing?.width ??
      null;

    const height =
      data.height ??
      data.pricing?.height_in ??
      data.pricing?.height ??
      null;

    const quantity =
      data.quantity ??
      data.pricing?.quantity ??
      null;

    // total can arrive as dollars or cents depending on which script version ran
    // - If data.total exists, assume dollars (e.g., 30.00)
    // - Else if pricing.total_cents exists, use cents
    const totalCents =
      typeof data.total === "number"
        ? Math.round(data.total * 100)
        : (typeof data.total === "string" && data.total.trim() !== "")
          ? Math.round(Number(data.total) * 100)
          : (typeof data.pricing?.total_cents === "number")
            ? Math.round(data.pricing.total_cents)
            : null;

    if (!width || !height || !quantity || !totalCents) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields.",
          received: { width, height, quantity, totalCents },
        }),
      };
    }

    // Safety: ensure minimum 50 cents and integer
    const safeTotalCents = Math.max(50, Math.round(totalCents));

    const jobName =
      data.jobName ||
      data.order?.project_name ||
      data.order?.jobName ||
      "";

    const upload_source =
      data.upload_source ||
      data.order?.upload_source ||
      "File Request Pro";

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
            unit_amount: safeTotalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        job_name: String(jobName),
        width: String(width),
        height: String(height),
        quantity: String(quantity),
        upload_source: String(upload_source),
      },
      success_url: "https://www.unfoldingcreative.com/order-success",
      cancel_url: "https://www.unfoldingcreative.com/orderstickers",
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
