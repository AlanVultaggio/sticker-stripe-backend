// netlify/functions/create-checkout.js

const { calculateStickerOrder } = require("./pricing-engine");

const DEFAULT_ORIGINS = [
  "https://www.unfoldingcreative.com",
  "https://unfoldingcreative.com",
  "https://sticker-stripe-backend.netlify.app"
];

const DEFAULT_ORIGIN = "https://www.unfoldingcreative.com";
const FLAT_RATE_SHIPPING_CENTS = 895;
const FREE_SHIPPING_THRESHOLD_CENTS = 7500;

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function getShapeProductName(shape) {
  const map = {
    "square-rectangle": "Square / Rectangle Stickers",
    "circle-oval": "Circle / Oval Stickers",
    diecut: "Custom Kiss-Cut Stickers",
    "sticker-sheet": "Sticker Sheets"
  };

  return map[String(shape || "").toLowerCase()] || "Custom Stickers";
}

function getAllowedOrigins() {
  const originsEnv = process.env.ALLOWED_ORIGINS;
  const source = originsEnv ? originsEnv : DEFAULT_ORIGINS.join(",");

  return new Set(
    source
      .split(",")
      .map((o) => normalizeOrigin(o))
      .filter(Boolean)
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
    Vary: "Origin"
  };
}

function jsonResponse(statusCode, corsHeaders, body) {
  return {
    statusCode,
    headers: Object.assign(
      {
        "Content-Type": "application/json"
      },
      corsHeaders || {}
    ),
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  const corsHeaders = getCorsHeaders(event);
  const method = event && event.httpMethod;

  if (method === "OPTIONS") {
    if (!corsHeaders) {
      return {
        statusCode: 403,
        headers: { Vary: "Origin" },
        body: ""
      };
    }

    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ""
    };
  }

  if (!corsHeaders) {
    return jsonResponse(403, { Vary: "Origin" }, { error: "Origin not allowed" });
  }

  if (method !== "POST") {
    return jsonResponse(405, corsHeaders, { error: "Method not allowed" });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return jsonResponse(500, corsHeaders, {
      error: "Server misconfigured: missing STRIPE_SECRET_KEY"
    });
  }

  let payload;
  try {
    payload = JSON.parse((event && event.body) || "{}");
  } catch (e) {
    return jsonResponse(400, corsHeaders, { error: "Invalid JSON body" });
  }

  const width = Number(payload.width);
  const height = Number(payload.height);
  const quantity = Number(payload.quantity);

  const order = calculateStickerOrder(width, height, quantity);

  if (!order) {
    return jsonResponse(400, corsHeaders, {
      error: "Invalid size or quantity"
    });
  }

  const normalizedDeliveryMethod =
    payload.delivery_method === "pickup" ? "pickup" : "shipping";

  const normalizedDeliveryLabel =
    normalizedDeliveryMethod === "pickup" ? "Local Pickup" : "Standard Shipping";

  const productSubtotalCents = order.finalTotalCents;
  const unitCents = Math.max(1, Math.round(productSubtotalCents / quantity));

  const shippingCents =
    normalizedDeliveryMethod === "pickup"
      ? 0
      : productSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
        ? 0
        : FLAT_RATE_SHIPPING_CENTS;

  const finalTotalCents = productSubtotalCents + shippingCents;

  console.log("pricing debug", {
    width,
    height,
    quantity,
    productSubtotalCents,
    unitCents,
    shippingCents,
    finalTotalCents,
    delivery_method: normalizedDeliveryMethod
  });

  try {
    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecret);

    const successUrl =
      process.env.CHECKOUT_SUCCESS_URL ||
      `${DEFAULT_ORIGIN}/thank-you?checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      process.env.CHECKOUT_CANCEL_URL ||
      `${DEFAULT_ORIGIN}/orderstickers?checkout=cancel`;

    const shape =
      (payload.order && payload.order.shape) ||
      payload.shape ||
      "";

    const finish =
      (payload.order && payload.order.finish) ||
      payload.finish ||
      "";

    const projectName =
      payload.jobName ||
      (payload.order && payload.order.project_name) ||
      "";

    const productName = getShapeProductName(shape);

    const productDescriptionParts = [
      `${String(payload.width || "?")}x${String(payload.height || "?")} in`,
      `Qty ${String(payload.quantity || "?")}`,
      finish || ""
    ].filter(Boolean);

    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: productName,
            description: projectName || productDescriptionParts.join(" • ")
          },
          unit_amount: productSubtotalCents
        },
        quantity: 1
      }
    ];

    if (shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: normalizedDeliveryLabel,
            description: "Flat rate per order"
          },
          unit_amount: shippingCents
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,

      shipping_address_collection: {
        allowed_countries: ["US"]
      },

      line_items: lineItems,

      metadata: {
        width: String(payload.width || ""),
        height: String(payload.height || ""),
        quantity: String(payload.quantity || ""),
        unit_cents: String(unitCents),
        product_subtotal_cents: String(productSubtotalCents),
        shipping_cents: String(shippingCents),
        total_cents: String(finalTotalCents),
        delivery_method: normalizedDeliveryMethod,
        delivery_label: normalizedDeliveryLabel,
        jobName: String(projectName || ""),
        upload_source: String(payload.upload_source || ""),
        shape: String(shape || ""),
        finish: String(finish || ""),
        lamination: String(payload.lamination || ""),
        material: String(payload.material || ""),
        rush: String(payload.rush || ""),
        notes: String(payload.notes || "")
      }
    });

    return jsonResponse(200, corsHeaders, {
      ok: true,
      id: session.id,
      url: session.url
    });
  } catch (error) {
    console.error("create-checkout error", error);
    return jsonResponse(500, corsHeaders, {
      error: "Unable to create checkout session"
    });
  }
};