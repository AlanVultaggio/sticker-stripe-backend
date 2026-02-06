(function () {
  // Prevent double-loading if Squarespace injects scripts twice
  if (window.UC_ORDERSTICKERS_LOADED) return;
  window.UC_ORDERSTICKERS_LOADED = true;

  const el = (id) => document.getElementById(id);

  // IMPORTANT: This must be your Netlify site URL (NOT unfoldingcreative.com)
  const NETLIFY_BASE = "https://sticker-stripe-backend.netlify.app";

  // Option A tier rates ($ per sqft)
  const RATE_PER_SQFT = {
    50: 12.75,
    100: 11.50,
    250: 10.50,
    500: 9.75,
    1000: 9.00
  };

  // $30 minimum total (in cents)
  const MIN_TOTAL_CENTS = 3000;

  function dollars(n) {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  // Gentle size-based multiplier:
  // - <= 9 in² : 1.00
  // - 9..16 in² : ramps down to 0.80
  // - >= 16 in² : 0.80 (cap)
  function sizeMultiplier(areaIn2) {
    if (areaIn2 <= 9) return 1.0;
    if (areaIn2 >= 16) return 0.80;
    const t = (areaIn2 - 9) / (16 - 9); // 0..1
    return 1.0 - (0.20 * t);            // 1.00 -> 0.80
  }

  function calcPrice({ widthIn, heightIn, qty }) {
    const w = parseFloat(widthIn || "0");
    const h = parseFloat(heightIn || "0");
    const q = parseInt(qty || "0", 10);

    if (!w || !h || !q) return { ok: false };

    const areaIn2 = w * h;
    const sqftEach = areaIn2 / 144;

    const rate = RATE_PER_SQFT[q] ?? RATE_PER_SQFT[50];

    // Base area pricing
    const baseUnitDollars = sqftEach * rate;

    // Apply gentle size multiplier (does NOT depend on finish/shape)
    const unitDollars = baseUnitDollars * sizeMultiplier(areaIn2);

    // Compute totals in cents
    const totalDollars = unitDollars * q;
    const rawTotalC = Math.round(totalDollars * 100);

    // Apply $30 minimum total
    const totalC = Math.max(rawTotalC, MIN_TOTAL_CENTS);

    // If minimum kicks in, unit becomes total/qty
    const unitC = Math.max(1, Math.round(totalC / q));

    return { ok: true, w, h, q, unitC, totalC };
  }

  function safeJsonParse(res) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      // If we ever get HTML here, it means wrong endpoint or forbidden page
      return res.text().then((t) => {
        throw new Error("Expected JSON, got: " + t.slice(0, 120));
      });
    }
    return res.json();
  }

  function init() {
    const form = el("stickerOrderForm");
    const widthInEl = el("widthIn");
    const heightInEl = el("heightIn");
    const qtyEl = el("quantity");

    const ppuEl = el("ppu");
    const totalEl = el("total");
    const unitPriceCentsEl = el("unitPriceCents");
    const totalCentsEl = el("totalCents");

    const statusEl = el("checkoutStatus");
    const checkoutBtn = el("checkoutBtn");

    // If any are missing, just exit quietly (avoids breaking other pages)
    if (
      !form || !widthInEl || !heightInEl || !qtyEl ||
      !ppuEl || !totalEl || !unitPriceCentsEl || !totalCentsEl ||
      !statusEl || !checkoutBtn
    ) return;

    function renderCalc() {
      const c = calcPrice({
        widthIn: widthInEl.value,
        heightIn: heightInEl.value,
        qty: qtyEl.value
      });

      if (!c.ok) {
        ppuEl.textContent = "$—";
        totalEl.textContent = "$—";
        unitPriceCentsEl.value = "";
        totalCentsEl.value = "";
        return c;
      }

      ppuEl.textContent = dollars(c.unitC / 100);
      totalEl.textContent = dollars(c.totalC / 100);
      unitPriceCentsEl.value = String(c.unitC);
      totalCentsEl.value = String(c.totalC);
      return c;
    }

    ["input", "change"].forEach((evt) => {
      widthInEl.addEventListener(evt, renderCalc);
      heightInEl.addEventListener(evt, renderCalc);
      qtyEl.addEventListener(evt, renderCalc);
      form.addEventListener(evt, renderCalc);
    });

    renderCalc();

    checkoutBtn.addEventListener("click", async () => {
      statusEl.textContent = "";
      const c = renderCalc();

      if (!c.ok) {
        statusEl.textContent = "Please enter width, height, and quantity.";
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());

      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = "0.7";
      statusEl.textContent = "Redirecting to secure checkout…";

      try {
        // ✅ IMPORTANT: Use Netlify backend domain here
        const endpoint = `${NETLIFY_BASE}/.netlify/functions/create-checkout`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: data,
            pricing: {
              width_in: c.w,
              height_in: c.h,
              quantity: c.q,
              total_cents: c.totalC,
              unit_cents: c.unitC
            }
          })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Checkout failed (${res.status}): ${txt.slice(0, 200)}`);
        }

        const json = await safeJsonParse(res);

        if (!json || !json.url) throw new Error("Missing Stripe checkout URL");
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
