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
    return Buffer.from(event.body || "", "base64");
  }
  return event.body || "";
}

function formatMoneyFromCents(cents) {
  const amount = Number(cents || 0);
  return `$${(amount / 100).toFixed(2)}`;
}

function formatSize(width, height) {
  const w = String(width || "").trim();
  const h = String(height || "").trim();
  if (!w || !h) return "";
  return `${w}" × ${h}"`;
}

function formatShapeLabel(shape) {
  const raw = String(shape || "").trim().toLowerCase();

  const map = {
    "square-rectangle": "Square / Rectangle",
    "circle-oval": "Circle / Oval",
    diecut: "Custom Shape",
    "sticker-sheet": "Sticker Sheets",
  };

  return map[raw] || String(shape || "").trim();
}

function formatFinishLabel(finish) {
  const raw = String(finish || "").trim().toLowerCase();

  const map = {
    gloss: "Gloss",
    matte: "Matte",
  };

  return map[raw] || String(finish || "").trim();
}

function formatUploadSource(source) {
  const raw = String(source || "").trim().toLowerCase();

  const map = {
    file_request_pro: "File Request Pro",
    filerequestpro: "File Request Pro",
    "file request pro": "File Request Pro",
  };

  return map[raw] || String(source || "").trim();
}

function getShippingDetails(session) {
  return session?.shipping_details || null;
}

function formatAddressLines(shippingDetails) {
  const name = String(shippingDetails?.name || "").trim();
  const address = shippingDetails?.address || {};

  const line1 = String(address.line1 || "").trim();
  const line2 = String(address.line2 || "").trim();
  const city = String(address.city || "").trim();
  const state = String(address.state || "").trim();
  const postalCode = String(address.postal_code || "").trim();
  const country = String(address.country || "").trim();

  const cityLine = [city, state].filter(Boolean).join(", ");
  const cityStatePostal = [cityLine, postalCode].filter(Boolean).join(" ");

  return [name, line1, line2, cityStatePostal, country].filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method Not Allowed" };
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;

  const sheetUrl =
    process.env.GOOGLE_SHEET_WEBAPP_URL || process.env.GOOGLE_SHEET_WEBHOOK;
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

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const md = session.metadata || {};

      const sessionId = session.id;
      const paymentStatus = session.payment_status || "(unknown)";

      const customerEmail =
        session?.customer_details?.email ||
        session?.customer_email ||
        "";

      const customerName =
        session?.customer_details?.name ||
        "";

      const customerPhone =
        session?.customer_details?.phone ||
        "";

      const shippingDetails = getShippingDetails(session);
      const shippingAddressLines = formatAddressLines(shippingDetails);

      const shapeLabel = formatShapeLabel(md.shape);
      const finishLabel = formatFinishLabel(md.finish);
      const sizeLabel = formatSize(md.width, md.height);
      const uploadSource = formatUploadSource(md.upload_source) || "File Request Pro";

      // ---------- BOOKKEEPING TOTALS ----------
      // Metadata values from your pricing engine / create-checkout.js
      const productSubtotalCents = Number(md.product_subtotal_cents || 0);
      const shippingCents = Number(md.shipping_cents || 0);
      const metadataPretaxTotalCents = Number(md.total_cents || 0);

      // Stripe-confirmed financial totals
      const amountSubtotalCents =
        typeof session.amount_subtotal === "number" ? session.amount_subtotal : 0;

      const amountTotalCents =
        typeof session.amount_total === "number" ? session.amount_total : 0;

      const taxCents =
        typeof session?.total_details?.amount_tax === "number"
          ? session.total_details.amount_tax
          : 0;

      const amountSubtotalDisplay = formatMoneyFromCents(amountSubtotalCents);
      const amountTotalDisplay = formatMoneyFromCents(amountTotalCents);

      console.log("✅ checkout.session.completed");
      console.log("Session:", sessionId);
      console.log("Customer email:", customerEmail || "(not provided)");
      console.log("Payment status:", paymentStatus);
      console.log("Product subtotal cents:", productSubtotalCents);
      console.log("Shipping cents:", shippingCents);
      console.log("Tax cents:", taxCents);
      console.log("Stripe subtotal cents:", amountSubtotalCents);
      console.log("Stripe total cents:", amountTotalCents);

      if (!resendKey) {
        console.warn("RESEND_API_KEY missing — skipping internal email send.");
      } else {
        const subject = `New Sticker Order — ${amountTotalDisplay} (${paymentStatus})`;

        const lines = [
          `New Sticker Order (Stripe)`,
          ``,

          `PROJECT`,
          md.jobName || "Sticker Order",
          ``,

          `CUSTOMER`,
          customerName || "(not provided)",
          customerEmail || "",
          customerPhone || "",
          ``,

          ...(shippingAddressLines.length
            ? ["SHIPPING ADDRESS", ...shippingAddressLines, ``]
            : []),

          `PRODUCT`,
          shapeLabel || "Custom Stickers",
          sizeLabel,
          `Qty: ${md.quantity || ""}`,
          `Finish: ${finishLabel || "—"}`,
          ``,

          `DELIVERY`,
          md.delivery_label || "",
          shippingCents === 0
            ? (md.delivery_method === "pickup" ? "Free Pickup" : "Free Shipping")
            : formatMoneyFromCents(shippingCents),
          ``,

          `UPLOAD`,
          uploadSource,
          ``,

          `PRICING`,
          `Product subtotal: ${formatMoneyFromCents(productSubtotalCents)}`,
          `Shipping: ${shippingCents === 0 ? "Free" : formatMoneyFromCents(shippingCents)}`,
          `Pre-tax subtotal: ${amountSubtotalDisplay}`,
          `Sales tax: ${formatMoneyFromCents(taxCents)}`,
          `Total paid: ${amountTotalDisplay}`,
          ``,

          `NOTES`,
          md.notes || "—",
          ``,

          `INTERNAL`,
          `Shape code: ${md.shape || ""}`,
          `Session ID: ${sessionId}`,
          `Payment Intent: ${session.payment_intent || ""}`,
          `Metadata pre-tax total: ${formatMoneyFromCents(metadataPretaxTotalCents)}`,
          `Created: ${new Date((session.created || 0) * 1000).toISOString()}`
        ].filter(Boolean);

        const textBody = lines.join("\n");

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

      if (!sheetUrl || !sheetSecret) {
        console.warn(
          "Google Sheet logging skipped — missing GOOGLE_SHEET_WEBAPP_URL/GOOGLE_SHEET_SECRET"
        );
      } else {
        try {
          const payload = {
            secret: sheetSecret,
            contents: {
              /* ---------- CORE STRIPE DATA ---------- */
              order_id: sessionId,
              checkout_session_id: sessionId,
              stripe_event_id: stripeEvent.id || "",
              payment_intent_id: session.payment_intent || "",
              mode: session.mode || "",

              /* ---------- PAYMENT ---------- */
              currency: (session.currency || "usd").toUpperCase(),
              status: paymentStatus,
              order_status: paymentStatus,

              // Best-practice bookkeeping fields
              product_subtotal_cents: String(productSubtotalCents),
              shipping_cents: String(shippingCents),
              subtotal_cents: String(amountSubtotalCents),
              tax_cents: String(taxCents),
              total_paid_cents: String(amountTotalCents),

              product_subtotal: formatMoneyFromCents(productSubtotalCents),
              shipping_amount: formatMoneyFromCents(shippingCents),
              subtotal_amount: formatMoneyFromCents(amountSubtotalCents),
              tax_amount: formatMoneyFromCents(taxCents),
              amount_total: formatMoneyFromCents(amountTotalCents),

              // Legacy compatibility
              total_cents: String(amountTotalCents),

              /* ---------- CUSTOMER ---------- */
              customer_email: customerEmail || "",
              customer_name: customerName || "",
              phone: customerPhone || "",

              /* ---------- JOB INFO ---------- */
              job_name: md.jobName || "",

              /* ---------- SIZE ---------- */
              width: md.width || "",
              height: md.height || "",
              width_in: md.width || "",
              height_in: md.height || "",

              /* ---------- QUANTITY / PRICING ---------- */
              quantity: md.quantity || "",
              unit_cents: md.unit_cents || "",

              /* ---------- PRODUCT OPTIONS ---------- */
              shape: md.shape || "",
              finish: md.finish || "",
              lamination: md.lamination || md.finish || "",
              material: md.material || "",
              rush: md.rush || "",

              /* ---------- FILE UPLOAD ---------- */
              upload_source: md.upload_source || "",
              upload_url: md.upload_url || md.upload_source || "",
              upload_confirmed: md.upload_confirmed || "",

              /* ---------- PREFLIGHT / PROOF ---------- */
              proof_required: md.proof_required || "",

              /* ---------- DELIVERY ---------- */
              delivery_method: md.delivery_method || "",
              delivery_label: md.delivery_label || "",

              /* ---------- ADDRESS ---------- */
              shipping_name: shippingDetails?.name || "",
              shipping_line1: shippingDetails?.address?.line1 || "",
              shipping_line2: shippingDetails?.address?.line2 || "",
              shipping_city: shippingDetails?.address?.city || "",
              shipping_state: shippingDetails?.address?.state || "",
              shipping_postal_code: shippingDetails?.address?.postal_code || "",
              shipping_country: shippingDetails?.address?.country || "",

              /* ---------- NOTES ---------- */
              notes: md.notes || "",

              /* ---------- DEBUG / ORIGIN ---------- */
              source_origin: "stripe-webhook"
            }
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