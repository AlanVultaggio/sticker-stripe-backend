// netlify/functions/create-checkout.js

const DEFAULT_ORIGINS = [
  "https://www.unfoldingcreative.com",
  "https://unfoldingcreative.com",
  "https://sticker-stripe-backend.netlify.app",
];

const DEFAULT_ORIGIN = "https://www.unfoldingcreative.com";

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function getAllowedOrigins() {
  const originsEnv = process.env.ALLOWED_ORIGINS; // comma-separated
  const source = originsEnv ? originsEnv : DEFAULT_ORIGINS.join(",");

  return new Set(
    source
      .split(",")
      .map((o) => normalizeOrigin(o))
      .filter(Boolean),
  );
}

function getRequestOrigin(event) {
  const headers = (event && event.headers) || {};
  return normalizeOrigin(headers.origin || headers.Origin || "");
}

function getCorsHeaders(event) {
  const requestOrigin = getRequestOrigin(event);
  const allowedOrigins = getAllowedOrigins();

  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(statusCode, corsHeaders, body) {
  return {
    statusCode,
    headers: Object.assign(
      {
        "Content-Type": "application/json",
      },
      corsHeaders || {},
    ),
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  const corsHeaders = getCorsHeaders(event);
  const method = event && event.httpMethod;

  // Preflight
  if (method === "OPTIONS") {
    if (!corsHeaders) {
      return { statusCode: 403, headers: { Vary: "Origin" }, body: "" };
    }
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // CORS gate
  if (!corsHeaders) {
    return jsonResponse(403, { Vary: "Origin" }, { error: "Origin not allowed" });
  }

  // Method gate
  if (method !== "POST") {
    return jsonResponse(405, corsHeaders, { error: "Method not allowed" });
  }

  // Env gate
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return jsonResponse(500, corsHeaders, {
      error: "Server misconfigured: missing STRIPE_SECRET_KEY",
    });
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse((event && event.body) || "{}");
  } catch (e) {
    return jsonResponse(400, corsHeaders, { error: "Invalid JSON body" });
  }

  // Validate amount
  const totalCents = Number.parseInt(payload.total_cents, 10);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return jsonResponse(400, corsHeaders, { error: "Invalid total_cents" });
  }

  try {
    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecret);

    const successUrl =
      process.env.CHECKOUT_SUCCESS_URL ||
      `${DEFAULT_ORIGIN}/thank-you?checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      process.env.CHECKOUT_CANCEL_URL ||
      `${DEFAULT_ORIGIN}/sticker-order?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Custom Sticker Order",
              description:
                payload.jobName ||
                `${String(payload.width || "?")}x${String(payload.height || "?")} in`,
            },
            // NOTE: We’re charging the total as a single line item (quantity 1)
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
// netlify/functions/create-checkout.js

const DEFAULT_ORIGINS = [
  "https://www.unfoldingcreative.com",
  "https://unfoldingcreative.com",
  "https://sticker-stripe-backend.netlify.app",
];

const DEFAULT_ORIGIN = "https://www.unfoldingcreative.com";

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function getAllowedOrigins() {
  const originsEnv = process.env.ALLOWED_ORIGINS; // comma-separated
  const source = originsEnv ? originsEnv : DEFAULT_ORIGINS.join(",");

  return new Set(
    source
      .split(",")
      .map((o) => normalizeOrigin(o))
      .filter(Boolean),
  );
}

function getRequestOrigin(event) {
  const headers = (event && event.headers) || {};
  return normalizeOrigin(headers.origin || headers.Origin || "");
}

function getCorsHeaders(event) {
  const requestOrigin = getRequestOrigin(event);
  const allowedOrigins = getAllowedOrigins();

  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(statusCode, corsHeaders, body) {
  return {
    statusCode,
    headers: Object.assign(
      {
        "Content-Type": "application/json",
      },
      corsHeaders || {},
    ),
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  const corsHeaders = getCorsHeaders(event);
  const method = event && event.httpMethod;

  // Preflight
  if (method === "OPTIONS") {
    if (!corsHeaders) {
      return { statusCode: 403, headers: { Vary: "Origin" }, body: "" };
    }
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // CORS gate
  if (!corsHeaders) {
    return jsonResponse(403, { Vary: "Origin" }, { error: "Origin not allowed" });
  }

  // Method gate
  if (method !== "POST") {
    return jsonResponse(405, corsHeaders, { error: "Method not allowed" });
  }

  // Env gate
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return jsonResponse(500, corsHeaders, {
      error: "Server misconfigured: missing STRIPE_SECRET_KEY",
    });
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse((event && event.body) || "{}");
  } catch (e) {
    return jsonResponse(400, corsHeaders, { error: "Invalid JSON body" });
  }

  // Validate amount
  const totalCents = Number.parseInt(payload.total_cents, 10);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return jsonResponse(400, corsHeaders, { error: "Invalid total_cents" });
  }

  try {
    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecret);

    const successUrl =
      process.env.CHECKOUT_SUCCESS_URL ||
      `${DEFAULT_ORIGIN}/thank-you?checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      process.env.CHECKOUT_CANCEL_URL ||
      `${DEFAULT_ORIGIN}/sticker-order?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Custom Sticker Order",
              description:
                payload.jobName ||
                `${String(payload.width || "?")}x${String(payload.height || "?")} in`,
            },
            // NOTE: We’re charging the total as a single line item (quantity 1)
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
metadata: {
  width: String(payload.width || ""),
  height: String(payload.height || ""),
  quantity: String(payload.quantity || ""),
  unit_cents: String(payload.unit_cents || ""),
  total_cents: String(payload.total_cents || ""),
  jobName: String(payload.jobName || ""),
  upload_source: String(payload.upload_source || ""),

  // sticker configuration
  shape: String(payload.shape || ""),
  lamination: String(payload.lamination || ""), // gloss or matte
  material: String(payload.material || ""),

  // order options
  rush: String(payload.rush || ""),
  notes: String(payload.notes || ""),
},
    });

    return jsonResponse(200, corsHeaders, {
      ok: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("create-checkout error", error);
    return jsonResponse(500, corsHeaders, { error: "Unable to create checkout session" });
  }
};
    });

    return jsonResponse(200, corsHeaders, {
      ok: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("create-checkout error", error);
    return jsonResponse(500, corsHeaders, { error: "Unable to create checkout session" });
  }
};
