(function () {
  // Prevent loading twice (Squarespace sometimes injects scripts twice)
  if (window.UC_ORDERSTICKERS_LOADED) return;
  window.UC_ORDERSTICKERS_LOADED = true;

  const el = (id) => document.getElementById(id);

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
    const t = (areaIn2 - 9) / (16 - 9);
    return 1.0 - (0.20 * t);
  }

  function calc() {
    const widthIn = el("widthIn");
    const heightIn = el("heightIn");
    const qty = el("quantity");

    const ppu = el("ppu");
    const total = el("total");

    const unitPriceCents = el("unitPriceCents");
    const totalCents = el("totalCents");

    if (!widthIn || !heightIn || !qty || !ppu || !total || !unitPriceCents || !totalCents) {
      return { ok: false };
    }

    const w = parseFloat(widthIn.value || "0");
    const h = parseFloat(heightIn.value || "0");
    const q = parseInt(qty.value || "0", 10);

    if (!w || !h || !q) {
      ppu.textContent = "$—";
      total.textContent = "$—";
      unitPriceCents.value = "";
      totalCents.value = "";
      return { ok: false };
    }

    const areaIn2 = w * h;
    const sqftEach = areaIn2 / 144;

    const rate = RATE_PER_SQFT[q] ?? RATE_PER_SQFT[50];

    const baseUnitDollars = sqftEach * rate;
    const unitDollars = baseUnitDollars * sizeMultiplier(areaIn2);

    const totalDollars = unitDollars * q;
    const rawTotalC = Math.round(totalDollars * 100);

    const totalC = Math.max(rawTotalC, MIN_TOTAL_CENTS);
    const unitC = Math.max(1, Math.round(totalC / q));

    ppu.textContent = dollars(unitC / 100);
    total.textContent = dollars(totalC / 100);

    unitPriceCents.value = String(unitC);
    totalCents.value = String(totalC);

    return { ok: true, w, h, q, unitC, totalC };
  }

  function init() {
    const form = el("stickerOrderForm");
    const widthIn = el("widthIn");
    const heightIn = el("heightIn");
    const qty = el("quantity");
    const checkoutBtn = el("checkoutBtn");
    const status = el("checkoutStatus");

    if (!form || !widthIn || !heightIn || !qty || !checkoutBtn || !status) {
      return;
    }

    ["input", "change"].forEach(evt => {
      widthIn.addEventListener(evt, calc);
      heightIn.addEventListener(evt, calc);
      qty.addEventListener(evt, calc);
      form.addEventListener(evt, calc);
    });

    calc();

    checkoutBtn.addEventListener("click", async () => {
      status.textContent = "";

      const c = calc();
      if (!c.ok) {
        status.textContent = "Please enter width, height, and quantity.";
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());

      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = "0.7";
      status.textContent = "Redirecting to secure checkout…";

      try {
        const res = await fetch("/.netlify/functions/create-checkout", {
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

        if (!res.ok) throw new Error("Checkout session failed");
        const json = await res.json();

        if (!json || !json.url) throw new Error("Missing Stripe checkout URL");

        window.location.href = json.url;
      } catch (err) {
        console.error(err);
        status.textContent = "Sorry—checkout couldn’t start. Please try again.";
        checkoutBtn.disabled = false;
        checkoutBtn.style.opacity = "1";
      }
    });
  }

  // Wait until DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
