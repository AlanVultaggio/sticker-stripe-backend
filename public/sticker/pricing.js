(function () {
  if (window.UC_PRICING_LOADED) return;
  window.UC_PRICING_LOADED = true;

  const el = (id) => document.getElementById(id);
  const MIN_EFFECTIVE_RATE_PER_SQFT = 3.38;

  const CONFIG = {
    minWidth: 1,
    minHeight: 1,
    maxWidth: 24,
    maxHeight: 24,
    minimumBillableAreaSqIn: 4,
    minimumOrderDollars: 34.95,
    flatRateShippingCents: 895,
    freeShippingThresholdCents: 7500,
    quantitySqFtRates: {
      25: 22,
      50: 19,
      100: 14.08,
      250: 8.6,
      500: 6.8,
      1000: 5.1,
      2500: 4.2,
      5000: 3.6
    },
    largeSizeAdjustments: [
      { minAreaSqIn: 16, multiplier: 0.74 },
      { minAreaSqIn: 24, multiplier: 0.64 },
      { minAreaSqIn: 36, multiplier: 0.52 },
      { minAreaSqIn: 64, multiplier: 0.48 },
      { minAreaSqIn: 121, multiplier: 0.44 }
    ]
  };

  const form = el("stickerOrderForm");
  const widthIn = el("widthIn");
  const heightIn = el("heightIn");
  const qty = el("quantity");
  const finish = el("finish");
  const deliveryMethod = el("deliveryMethod");

  const ppu = el("ppu");
  const total = el("total");

  const estimateTotal = el("estimateTotal");
  const estimateUnit = el("estimateUnit");

  const summarySize = el("summarySize");
  const summaryQty = el("summaryQty");
  const summaryFinish = el("summaryFinish");
  const summaryDelivery = el("summaryDelivery");
  const summaryShipping = el("summaryShipping");

  const unitPriceCents = el("unitPriceCents");
  const totalCents = el("totalCents");
  const shippingCents = el("shippingCents");
  const deliveryLabel = el("deliveryLabel");

  const statusEl = el("checkoutStatus");

  if (
    !form ||
    !widthIn ||
    !heightIn ||
    !qty ||
    !ppu ||
    !total ||
    !unitPriceCents ||
    !totalCents
  ) {
    return;
  }

  function dollars(n) {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function getShippingCents(productSubtotalCents) {
    if (!deliveryMethod) {
      return (productSubtotalCents || 0) >= CONFIG.freeShippingThresholdCents
        ? 0
        : CONFIG.flatRateShippingCents;
    }

    if (deliveryMethod.value === "pickup") return 0;

    return (productSubtotalCents || 0) >= CONFIG.freeShippingThresholdCents
      ? 0
      : CONFIG.flatRateShippingCents;
  }

  function getDeliveryLabel() {
    if (!deliveryMethod) return "Standard Shipping";
    return deliveryMethod.value === "pickup" ? "Local Pickup" : "Standard Shipping";
  }

  function updateDeliverySummary(productSubtotalCents) {
    const shipping = getShippingCents(productSubtotalCents);
    const delivery = getDeliveryLabel();

    if (summaryDelivery) summaryDelivery.textContent = delivery;
    if (summaryShipping) summaryShipping.textContent = shipping === 0 ? "Free" : dollars(shipping / 100);
    if (shippingCents) shippingCents.value = String(shipping);
    if (deliveryLabel) deliveryLabel.value = delivery;
  }

  function clearDisplay(message) {
    updateDeliverySummary(0);

    ppu.textContent = "$—";
    total.textContent = "$—";
    if (estimateTotal) estimateTotal.textContent = "$—";
    if (estimateUnit) estimateUnit.textContent = "$— per sticker";

    unitPriceCents.value = "";
    totalCents.value = "";

    if (summarySize) summarySize.textContent = "—";
    if (summaryQty) summaryQty.textContent = "—";
    if (summaryFinish && finish) {
      summaryFinish.textContent = finish.options[finish.selectedIndex]?.text || finish.value;
    }

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

    return Math.max(adjustedRate, MIN_EFFECTIVE_RATE_PER_SQFT);
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

    if (
      w < CONFIG.minWidth ||
      w > CONFIG.maxWidth ||
      h < CONFIG.minHeight ||
      h > CONFIG.maxHeight
    ) {
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

    const rawProductSubtotalDollars = areaSqFt * q * ratePerSqFt;
    const productSubtotalDollars = Math.max(rawProductSubtotalDollars, CONFIG.minimumOrderDollars);
    const productSubtotalCents = Math.round(productSubtotalDollars * 100);

    const unitC = Math.max(1, Math.round(productSubtotalCents / q));

    const shipping = getShippingCents(productSubtotalCents);
    const finalTotalCents = productSubtotalCents + shipping;

    updateDeliverySummary(productSubtotalCents);

    ppu.textContent = dollars(unitC / 100);
    total.textContent = dollars(finalTotalCents / 100);

    if (estimateTotal) estimateTotal.textContent = dollars(finalTotalCents / 100);
    if (estimateUnit) {
      estimateUnit.textContent =
        shipping > 0
          ? `${dollars(unitC / 100)} per sticker + ${dollars(shipping / 100)} shipping`
          : `${dollars(unitC / 100)} per sticker`;
    }

    if (summarySize) summarySize.textContent = `${w}" × ${h}"`;
    if (summaryQty) summaryQty.textContent = String(q);

    if (summaryFinish && finish) {
      summaryFinish.textContent = finish.options[finish.selectedIndex]?.text || finish.value;
    }

    unitPriceCents.value = String(unitC);
    totalCents.value = String(finalTotalCents);

    return {
      ok: true,
      width: w,
      height: h,
      quantity: q,
      actualAreaSqIn,
      billableAreaSqIn,
      areaSqFt,
      ratePerSqFt,
      productSubtotalDollars,
      productSubtotalCents,
      shippingCents: shipping,
      finalTotalCents
    };
  }

  ["input", "change"].forEach((evt) => {
    widthIn.addEventListener(evt, calc);
    heightIn.addEventListener(evt, calc);
    qty.addEventListener(evt, calc);

    if (finish) finish.addEventListener(evt, calc);
    if (deliveryMethod) deliveryMethod.addEventListener(evt, calc);
  });

  calc();
})();