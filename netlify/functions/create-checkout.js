const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const headers = {
  "Access-Control-Allow-Origin": "https://www.unfoldingcreative.com",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const { width, height, quantity, total } = data;

    if (!width || !height || !quantity || !total) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

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
              description: `${quantity} stickers — ${width}x${height}`,
            },
            unit_amount: Math.round(Number(total) * 100),
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
    console.error(err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
