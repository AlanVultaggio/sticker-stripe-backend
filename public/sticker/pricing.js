(function () {
  if (window.UC_PRICING_LOADED) return;
  window.UC_PRICING_LOADED = true;

  const el = (id) => document.getElementById(id);

  const CONFIG = {
    minWidth: 1,
    minHeight: 1,
    maxWidth: 24,
    maxHeight: 24,
    minimumBillableAreaSqIn: 4,
    minimumOrderDollars: 36.95,
    quantitySqFtRates: {
      25: 22,
      50: 19,
      100: 16,
      250: 13,
      500: 11,
      1000: 9,
      2500: 7.25,
      5000: 6
    },
    largeSizeAdjustments: [
      { minAreaSqIn: 16, multiplier: 0.62 },
      { minAreaSqIn: 24, multiplier: 0.45 },
      { minAreaSqIn: 36, multiplier: 0.375 },
      { minAreaSqIn: 64, multiplier: 0.3025 },
      { minAreaSqIn: 121, multiplier: 0.32 }
   ]
  };

  const form = el("stickerOrderForm");
  const widthIn = el("widthIn");
  const heightIn = el("heightIn");
  const qty = el("quantity");

  const ppu = el("ppu");
  const total = el("total");

  const estimateTotal = el("estimateTotal");
  const estimateUnit = el("estimateUnit");

  const unitPriceCents = el("unitPriceCents");
  const totalCents = el("totalCents");

  const statusEl = el("checkoutStatus");

  if (!form || !widthIn || !heightIn || !qty || !ppu || !total || !unitPriceCents || !totalCents) {
    return;
  }

  function dollars(n) {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function clearDisplay(message) {
    ppu.textContent = "$—";
    total.textContent = "$—";
    if (estimateTotal) estimateTotal.textContent = "$—";
    if (estimateUnit) estimateUnit.textContent = "$— per sticker";
    unitPriceCents.value = "";
    totalCents.value = "";
    if (statusEl && message) statusEl.textContent = message;
  }

  function getValidatedQuantity(quantity) {
    const q = Number.parseInt(quantity, 10);
    return CONFIG.quantitySqFtRates[q] ? q : null;
  }

  function getBillableAreaSqIn(w, h) {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return null;
    }

    if (w < CONFIG.minWidth || w > CONFIG.maxWidth) return null;
    if (h < CONFIG.minHeight || h > CONFIG.maxHeight) return null;

    return Math.max(w * h, CONFIG.minimumBillableAreaSqIn);
  }

  function getSqFtRate(quantity, billableAreaSqIn) {
    const baseRate = CONFIG.quantitySqFtRates[quantity];
    if (!baseRate) return null;

    let adjustedRate = baseRate;

    for (const rule of CONFIG.largeSizeAdjustments) {
      if (billableAreaSqIn >= rule.minAreaSqIn) {
        adjustedRate = baseRate * rule.multiplier;
      }
    }

    return adjustedRate;
  }

  function calc() {
    const w = Number.parseFloat(widthIn.value || "0");
    const h = Number.parseFloat(heightIn.value || "0");
    const q = getValidatedQuantity(qty.value || "0");

    if (statusEl) statusEl.textContent = "";

    if (!w || !h || !q) {
      clearDisplay("");
      return { ok: false };
    }

    if (w < CONFIG.minWidth || w > CONFIG.maxWidth || h < CONFIG.minHeight || h > CONFIG.maxHeight) {
      clearDisplay(`Size must be between ${CONFIG.minWidth}" and ${CONFIG.maxWidth}".`);
      return { ok: false };
    }

    const actualAreaSqIn = w * h;
    const billableAreaSqIn = getBillableAreaSqIn(w, h);

    if (!billableAreaSqIn) {
      clearDisplay("Invalid size.");
      return { ok: false };
    }

    const areaSqFt = billableAreaSqIn / 144;
    const ratePerSqFt = getSqFtRate(q, billableAreaSqIn);

    if (!ratePerSqFt) {
      clearDisplay("Invalid quantity.");
      return { ok: false };
    }

    const rawTotalDollars = areaSqFt * q * ratePerSqFt;
    const finalTotalDollars = Math.max(rawTotalDollars, CONFIG.minimumOrderDollars);
    const finalTotalC = Math.round(finalTotalDollars * 100);
    const unitC = Math.max(1, Math.round(finalTotalC / q));

    ppu.textContent = dollars(unitC / 100);
    total.textContent = dollars(finalTotalC / 100);
    if (estimateTotal) estimateTotal.textContent = dollars(finalTotalC / 100);
    if (estimateUnit) estimateUnit.textContent = `${dollars(unitC / 100)} per sticker`;
    if (summarySize) summarySize.textContent = `${w}" × ${h}"`;
    if (summaryQty) summaryQty.textContent = String(q);
    if (summaryFinish && finish) {
      summaryFinish.textContent = finish.options[finish.selectedIndex]?.text || finish.value;
    }
    unitPriceCents.value = String(unitC);
    totalCents.value = String(finalTotalC);

    return {
      ok: true,
      width: w,
      height: h,
      quantity: q,
      actualAreaSqIn,
      billableAreaSqIn,
      areaSqFt,
      ratePerSqFt,
      finalTotalDollars,
      finalTotalC
    };
  }

  ["input", "change"].forEach((evt) => {
    widthIn.addEventListener(evt, calc);
    heightIn.addEventListener(evt, calc);
    qty.addEventListener(evt, calc);
    if (finish) finish.addEventListener(evt, calc);
  });

  calc();
})();