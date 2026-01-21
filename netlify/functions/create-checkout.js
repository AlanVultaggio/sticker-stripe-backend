const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    // Friendly response for browser visits
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Use POST to create a Stripe Checkout session."
        })
      };
    }

    const data = JSON.parse(event.body || "{}");

    // Validate required fields
    const required = ["width", "height", "quantity", "total"];
    for (const key of required) {
      if (!data[key]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing field: ${key}` })
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
              description: `${data.quantity} stickers – ${data.width}x${data.height}`
            },
            unit_amount: Math.round(Number(data.total) * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        job_name: data.jobName || "",
        width: String(data.width),
        height: String(data.height),
        quantity: String(data.quantity),
        upload_source: data.upload_source || "File Request Pro"
      },
      success_url: "https://www.unfoldingcreative.com/order-success",
      cancel_url: "https://www.unfoldingcreative.com/orderstickers"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
