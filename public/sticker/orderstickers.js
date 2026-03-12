(function () {
  if (window.UC_ORDERSTICKERS_LOADED) return;
  window.UC_ORDERSTICKERS_LOADED = true;

  const el = (id) => document.getElementById(id);

  // Netlify backend domain
  const NETLIFY_BASE = "https://sticker-stripe-backend.netlify.app";

  function init() {
    const form = el("stickerOrderForm");
    const widthInEl = el("widthIn");
    const heightInEl = el("heightIn");
    const qtyEl = el("quantity");

    const unitPriceCentsEl = el("unitPriceCents");
    const totalCentsEl = el("totalCents");

    const shippingCentsEl = el("shippingCents");
    const deliveryMethodEl = el("deliveryMethod");
    const deliveryLabelEl = el("deliveryLabel");

    const statusEl = el("checkoutStatus");
    const checkoutBtn = el("checkoutBtn");

    if (
      !form || !widthInEl || !heightInEl || !qtyEl ||
      !unitPriceCentsEl || !totalCentsEl ||
      !shippingCentsEl || !deliveryMethodEl || !deliveryLabelEl ||
      !statusEl || !checkoutBtn
    ) return;

    checkoutBtn.addEventListener("click", async () => {
      statusEl.textContent = "";

      const w = parseFloat(widthInEl.value || "0");
      const h = parseFloat(heightInEl.value || "0");
      const q = parseInt(qtyEl.value || "0", 10);

      const unitC = parseInt(unitPriceCentsEl.value || "0", 10);
      const totalC = parseInt(totalCentsEl.value || "0", 10);
      const shippingC = parseInt(shippingCentsEl.value || "0", 10);

      const deliveryMethod = deliveryMethodEl.value || "shipping";
      const deliveryLabel = deliveryLabelEl.value || "Standard Shipping";

      const productSubtotalC = unitC * q;
      const expectedFinalTotalC = productSubtotalC + shippingC;

      if (!w || !h || !q || !unitC || !totalC) {
        statusEl.textContent = "Please enter width, height, and quantity.";
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());

      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = "0.7";
      statusEl.textContent = "Redirecting to secure checkout…";

      try {
        const endpoint = `${NETLIFY_BASE}/.netlify/functions/create-checkout`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            width: w,
            height: h,
            quantity: q,

            unit_cents: unitC,
            product_subtotal_cents: productSubtotalC,
            shipping_cents: shippingC,
            total_cents: expectedFinalTotalC,

            total: Number((expectedFinalTotalC / 100).toFixed(2)),

            delivery_method: deliveryMethod,
            delivery_label: deliveryLabel,

            jobName: data.project_name || "",
            order: data,
            upload_source: "File Request Pro",
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.error || `Checkout failed (${res.status})`);
        }

        if (!json.url) throw new Error("Missing Stripe checkout URL");
        window.location.href = json.url;
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Sorry—checkout couldn’t start. Please try again.";
        checkoutBtn.disabled = false;
        checkoutBtn.style.opacity = "1";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();