const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const headers = {
  "Access-Control-Allow-Origin": "https://www.unfoldingcreative.com",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // ✅ CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Friendly message for browser visits
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Use POST to create a Stripe Checkout session." }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    // Basic validation
    const required = ["width", "height", "quantity", "total"];
    for (const k of required) {
      if (!data[k]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing field: ${k}` }),
        };
      }
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
              description: `${data.quantity} stickers — ${data.width}x${data.height}`,
            },
            unit_amount: Math.round(Number(data.total) * 100), // total in cents
          },
          quantity: 1,
        },
      ],

      metadata: {
        job_name: data.jobName || "",
        width: String(data.width),
        height: String(data.height),
        quantity: String(data.quantity),
        upload_source: data.upload_source || "File Request Pro",
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
