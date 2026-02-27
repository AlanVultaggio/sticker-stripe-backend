const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ALLOWED_ORIGINS = [
  "https://www.unfoldingcreative.com",
  "https://unfoldingcreative.com",
];

function corsHeaders(origin) {
  const allowOrigin =
    ALLOWED_ORIGINS.includes(origin)
      ? origin
      : "https://www.unfoldingcreative.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "";
  const headers = corsHeaders(origin);

  // ✅ CRITICAL: handle preflight FIRST
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

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
              description: `${data.quantity} stickers — ${data.width}x${data.height}`,
            },
            unit_amount: Math.round(Number(data.total) * 100),
          },
          quantity: 1,
        },
      ],

      success_url:
        "https://www.unfoldingcreative.com/order-success",
      cancel_url:
        "https://www.unfoldingcreative.com/orderstickers",
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
