// netlify/functions/stripe-webhook.js

const Stripe = require("stripe");
const fetch = require("node-fetch");

// CORS is not required for Stripe -> webhook (server-to-server),
// but leaving OPTIONS support doesn't hurt.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyObj),
  };
}

// For Stripe signature verification we must use the EXACT raw payload bytes.
// If event.isBase64Encoded is true, decode to a Buffer.
function getRawBody(event) {
  if (!event) return "";
  if (event.isBase64Encoded) {
    return Buffer.from(event.body || "", "base64"); // Buffer (best for Stripe verify)
  }
  return event.body || ""; // string
}

exports.handler = async (event) => {
  // Handle preflight (not needed for Stripe, but safe)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method Not Allowed" };
  }

  // ---- ENV GUARDS ----
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;

  const sheetUrl =
    process.env.GOOGLE_SHEET_WEBAPP_URL || process.env.GOOGLE_SHEET_WEBHOOK; // support either name
  const sheetSecret = process.env.GOOGLE_SHEET_SECRET;

  if (!stripeSecret) {
    console.error("Missing STRIPE_SECRET_KEY");
    return json(500, { error: "Server misconfigured: missing STRIPE_SECRET_KEY" });
  }
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return json(500, { error: "Server misconfigured: missing STRIPE_WEBHOOK_SECRET" });
  }

  const stripe = new Stripe(stripeSecret);

  // ---- STRIPE SIGNATURE VERIFY ----
  let stripeEvent;
  try {
    const sig =
      event.headers["stripe-signature"] ||
      event.headers["Stripe-Signature"] ||
      event.headers["STRIPE-SIGNATURE"];

    if (!sig) {
      console.error("Missing Stripe-Signature header");
      return { statusCode: 400, body: "Webhook Error: Missing Stripe-Signature header" };
    }

    const rawBody = getRawBody(event);
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // After signature verify succeeds, we ACK 200 even if internal steps fail (your preference).
  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const sessionId = session.id;

      const amountTotal =
        typeof session.amount_total === "number" ? session.amount_total : 0;
      const dollars = (amountTotal / 100).toFixed(2);

      const customerEmail =
        session?.customer_details?.email ||
        session?.customer_email ||
        "";

      const paymentStatus = session.payment_status || "(unknown)";

      const md = session.metadata || {};

      console.log("✅ checkout.session.completed");
      console.log("Session:", sessionId);
      console.log("Customer email:", customerEmail || "(not provided)");
      console.log("Amount:", dollars);
      console.log("Payment status:", paymentStatus);

      // 1) ---- INTERNAL EMAIL VIA RESEND ----
      if (!resendKey) {
        console.warn("RESEND_API_KEY missing — skipping internal email send.");
      } else {
        const subject = `New Sticker Order — $${dollars} (${paymentStatus})`;

        const textBody = `New Sticker Order (Stripe)

Session ID: ${sessionId}
Customer Email: ${customerEmail || "(not provided)"}
Amount: $${dollars}
Payment Status: ${paymentStatus}

Job Name: ${md.jobName || ""}
Size: ${md.width || ""} x ${md.height || ""} in
Quantity: ${md.quantity || ""}

Shape: ${md.shape || ""}
Lamination: ${md.lamination || ""}
Material: ${md.material || ""}

Rush: ${md.rush || ""}
Notes: ${md.notes || ""}

Unit cents: ${md.unit_cents || ""}
Total cents: ${md.total_cents || ""}

Created: ${new Date((session.created || 0) * 1000).toISOString()}
`;

        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Unfolding Creative <info@unfoldingcreative.com>",
            to: ["info@unfoldingcreative.com"],
            bcc: ["amanda@unfoldingcreative.com"],
            reply_to: "info@unfoldingcreative.com",
            subject,
            text: textBody,
          }),
        });

        const resendJson = await resendResp.json().catch(() => ({}));
        console.log("Resend status:", resendResp.status);
        console.log("Resend response:", resendJson);

        if (!resendResp.ok) {
          console.error("Resend send failed:", resendJson);
        }
      }

      // 2) ---- LOG TO GOOGLE SHEETS ----
      if (!sheetUrl || !sheetSecret) {
        console.warn(
          "Google Sheet logging skipped — missing GOOGLE_SHEET_WEBAPP_URL/GOOGLE_SHEET_SECRET"
        );
      } else {
        try {
          const payload = {
            secret: sheetSecret,
            contents: {
              order_id: sessionId,
              customer_email: customerEmail || "",
              amount_total: dollars,
              currency: (session.currency || "usd").toUpperCase(),
              status: paymentStatus,

              job_name: md.jobName || "",
              width: md.width || "",
              height: md.height || "",
              quantity: md.quantity || "",

              unit_cents: md.unit_cents || "",
              total_cents: md.total_cents || "",

              shape: md.shape || "",
              lamination: md.lamination || "",
              material: md.material || "",

              rush: md.rush || "",
              notes: md.notes || "",
            },
          };

          const sheetResp = await fetch(sheetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const sheetJson = await sheetResp.json().catch(() => ({}));
          console.log("Sheet status:", sheetResp.status);
          console.log("Sheet response:", sheetJson);

          if (!sheetResp.ok) {
            console.error("Sheet logging failed:", sheetJson);
          }
        } catch (err) {
          console.error("Sheet logging error:", err);
        }
      }
    }

    return json(200, { received: true, type: stripeEvent.type });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    return json(200, {
      received: true,
      type: stripeEvent.type,
      warning: "handler_error_logged",
    });
  }
};