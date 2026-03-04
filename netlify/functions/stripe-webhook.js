// netlify/functions/stripe-webhook.js

const Stripe = require("stripe");
const fetch = require("node-fetch");

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

    // 👇 Checkout completed
if (stripeEvent.type === "checkout.session.completed") {
  const session = stripeEvent.data.object;

  console.log("✅ Checkout completed");
  console.log("Session ID:", session.id);
  console.log("Customer email:", session.customer_details?.email);
  console.log("Amount total:", session.amount_total);

  // ---- SEND EMAIL VIA RESEND ----
  if (session?.customer_details?.email) {
    const toEmail = session.customer_details.email;

    const dollars =
      typeof session.amount_total === "number"
        ? (session.amount_total / 100).toFixed(2)
        : "0.00";

    const subject = `New Sticker Order — $${dollars}`;

    const textBody = `New Sticker Order (Stripe)

Session ID: ${session.id}
Email: ${toEmail}
Amount: $${dollars}

Width: ${session.metadata.width}
Height: ${session.metadata.height}
Quantity: ${session.metadata.quantity}
Shape: ${session.metadata.shape}
Lamination Finish: ${session.metadata.lamination}
Material: ${session.metadata.material}
Rush: ${session.metadata.rush}
Notes: ${session.metadata.notes}

Payment Status: ${session.payment_status}
Created: ${new Date((session.created || 0) * 1000).toISOString()}
`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Unfolding Creative <onboarding@resend.dev>",
        to: ["info@unfoldingcreative.com"],
        cc: ["amanda@unfoldingcreative.com"],
        subject,
        text: textBody,
      }),
    });

    const resendJson = await resendResp.json().catch(() => ({}));

    console.log("Resend status:", resendResp.status);
    console.log("Resend response:", resendJson);
  } else {
    console.log("No customer email found on session.customer_details.email");
  }
  // ---- END RESEND EMAIL ----
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
