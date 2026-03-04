// netlify/functions/stripe-webhook.js

const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const sig =
      event.headers["stripe-signature"] ||
      event.headers["Stripe-Signature"];

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    );

    // 👇 THIS IS THE NEW PART
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      console.log("✅ Checkout completed");
      console.log("Session ID:", session.id);
      console.log("Customer email:", session.customer_details?.email);
      console.log("Amount total:", session.amount_total);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        received: true,
        type: stripeEvent.type,
      }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
