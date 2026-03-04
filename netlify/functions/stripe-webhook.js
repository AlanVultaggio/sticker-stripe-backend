// netlify/functions/stripe-webhook.js

const Stripe = require("stripe");

// IMPORTANT: Stripe needs the *raw* body for webhook signature verification.
// Netlify provides the raw payload on event.body.
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
    const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      return { statusCode: 500, body: "Missing STRIPE_WEBHOOK_SECRET" };
    }

    // Verify signature and construct event
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    );

    // For now we just acknowledge success.
    // Later we’ll add your order fulfillment logic here.
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, type: stripeEvent.type }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
