diff --git a/netlify/functions/create-checkout.js b/netlify/functions/create-checkout.js
index f09e82bc8bf68ac4cf06dfaf1fa9ec4563b43035..475d00ea24129ad9620de5fc6e73b5295a14083a 100644
--- a/netlify/functions/create-checkout.js
+++ b/netlify/functions/create-checkout.js
@@ -1,12 +1,150 @@
-exports.handler = async (event) => {
+const DEFAULT_ORIGINS = [
+  "https://www.unfoldingcreative.com",
+  "https://unfoldingcreative.com",
+  "https://sticker-stripe-backend.netlify.app",
+];
+
+const defaultOrigin = "https://www.unfoldingcreative.com";
+
+function getAllowedOrigins() {
+  var originsEnv = process.env.ALLOWED_ORIGINS;
+  var source = originsEnv ? originsEnv : DEFAULT_ORIGINS.join(",");
+
+  return new Set(
+    source
+      .split(",")
+      .map(function (origin) {
+        return origin.trim().replace(/\/$/, "");
+      })
+      .filter(Boolean),
+  );
+}
+
+function getRequestOrigin(event) {
+  var headers = (event && event.headers) || {};
+  var origin = headers.origin || headers.Origin || "";
+  return String(origin).trim().replace(/\/$/, "");
+}
+
+function getCorsHeaders(event) {
+  var requestOrigin = getRequestOrigin(event);
+  var allowedOrigins = getAllowedOrigins();
+
+  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
+    return null;
+  }
+
   return {
-    statusCode: 200,
-    headers: {
-      "Content-Type": "application/json",
-      "Access-Control-Allow-Origin": "https://www.unfoldingcreative.com",
-      "Access-Control-Allow-Headers": "Content-Type",
-      "Access-Control-Allow-Methods": "POST, OPTIONS",
-    },
-    body: JSON.stringify({ ok: true, method: event.httpMethod }),
+    "Access-Control-Allow-Origin": requestOrigin,
+    "Access-Control-Allow-Headers": "Content-Type",
+    "Access-Control-Allow-Methods": "POST, OPTIONS",
+    Vary: "Origin",
   };
+}
+
+function jsonResponse(statusCode, corsHeaders, body) {
+  return {
+    statusCode: statusCode,
+    headers: Object.assign(
+      {
+        "Content-Type": "application/json",
+      },
+      corsHeaders || {},
+    ),
+    body: JSON.stringify(body),
+  };
+}
+
+exports.handler = async function (event) {
+  var corsHeaders = getCorsHeaders(event);
+  var method = event && event.httpMethod;
+
+  if (method === "OPTIONS") {
+    if (!corsHeaders) {
+      return { statusCode: 403, headers: { Vary: "Origin" }, body: "" };
+    }
+
+    return {
+      statusCode: 204,
+      headers: corsHeaders,
+      body: "",
+    };
+  }
+
+  if (!corsHeaders) {
+    return jsonResponse(403, { Vary: "Origin" }, { error: "Origin not allowed" });
+  }
+
+  if (method !== "POST") {
+    return jsonResponse(405, corsHeaders, { error: "Method not allowed" });
+  }
+
+  var stripeSecret = process.env.STRIPE_SECRET_KEY;
+  if (!stripeSecret) {
+    return jsonResponse(500, corsHeaders, {
+      error: "Server misconfigured: missing STRIPE_SECRET_KEY",
+    });
+  }
+
+  var payload;
+  try {
+    payload = JSON.parse((event && event.body) || "{}");
+  } catch (error) {
+    return jsonResponse(400, corsHeaders, { error: "Invalid JSON body" });
+  }
+
+  var totalCents = Number.parseInt(payload.total_cents, 10);
+  if (!Number.isFinite(totalCents) || totalCents <= 0) {
+    return jsonResponse(400, corsHeaders, { error: "Invalid total_cents" });
+  }
+
+  try {
+    const Stripe = require("stripe");
+    const stripe = new Stripe(stripeSecret);
+
+    var successUrl =
+      process.env.CHECKOUT_SUCCESS_URL ||
+      defaultOrigin + "/thank-you?checkout=success&session_id={CHECKOUT_SESSION_ID}";
+    var cancelUrl =
+      process.env.CHECKOUT_CANCEL_URL || defaultOrigin + "/sticker-order?checkout=cancel";
+
+    var session = await stripe.checkout.sessions.create({
+      mode: "payment",
+      success_url: successUrl,
+      cancel_url: cancelUrl,
+      line_items: [
+        {
+          price_data: {
+            currency: "usd",
+            product_data: {
+              name: "Custom Sticker Order",
+              description:
+                payload.jobName ||
+                String(payload.width || "?") + "x" + String(payload.height || "?") + " in",
+            },
+            unit_amount: totalCents,
+          },
+          quantity: 1,
+        },
+      ],
+      metadata: {
+        width: String(payload.width || ""),
+        height: String(payload.height || ""),
+        quantity: String(payload.quantity || ""),
+        unit_cents: String(payload.unit_cents || ""),
+        total_cents: String(payload.total_cents || ""),
+        jobName: String(payload.jobName || ""),
+        upload_source: String(payload.upload_source || ""),
+      },
+    });
+
+    return jsonResponse(200, corsHeaders, {
+      ok: true,
+      id: session.id,
+      url: session.url,
+    });
+  } catch (error) {
+    console.error("create-checkout error", error);
+    return jsonResponse(500, corsHeaders, { error: "Unable to create checkout session" });
+  }
 };
