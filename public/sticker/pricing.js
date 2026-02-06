(function () {
  // Prevent double-loading if Squarespace injects twice
  if (window.UC_PRICING_LOADED) return;
  window.UC_PRICING_LOADED = true;

  const el = (id) => document.getElementById(id);

  // Tier rates ($ per sqft) for quantity dropdown values
  const RATE_PER_SQFT = {
    50: 12.75,
    100: 11.50,
    250: 10.50,
    500: 9.75,
    1000: 9.00
  };

  // $30 minimum order total
  const MIN_TOTAL_CENTS = 3000;

  // Elements expected on the page
  const form = el("stickerOrderForm");
  const widthIn = el("widthIn");
  const heightIn = el("heightIn");
  const qty = el("quantity");

  const ppu = el("ppu");
  const total = el("total");

  const unitPriceCents = el("unitPriceCents");
  const totalCents = el("totalCents");

  if (!form || !widthIn || !heightIn || !qty || !ppu || !total || !unitPriceCents || !totalCents) {
    // If elements aren't present, quietly do nothing.
    return;
  }

  function dollars(n) {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  // Gentle size multiplier:
  // <= 9 in² : 1.00
  // 9..16 in² : ramps down to 0.80
  // >= 16 in² : 0.80
  function sizeMultiplier(areaIn2) {
    if (areaIn2 <= 9) return 1.0;
    if (areaIn2 >= 16) return 0.80;
    const t = (areaIn2 - 9) / (16 - 9);
    return 1.0 - (0.20 * t);
  }

  function calc() {
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

    return { ok: true, w, h, q, areaIn2, sqftEach, rate, unitC, totalC };
  }

  ["input", "change"].forEach((evt) => {
    widthIn.addEventListener(evt, calc);
    heightIn.addEventListener(evt, calc);
    qty.addEventListener(evt, calc);
    form.addEventListener(evt, calc);
  });

  // initial calc
  calc();
})();
