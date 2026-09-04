package com.korobki.pricing;

import com.korobki.core.config.PricingConfig;
import lombok.Data;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Price calculator — pure math, no DB dependencies.
 * Configuration is externalized via PricingConfig (application.yml).
 *
 * Algorithm (в соответствии с НК РФ: скидка → НДС):
 * 1. roundedCost = totalCost.setScale(0, HALF_UP)  [rounding #1 — done by caller]
 * 2. basePrice = MIN(roundedCost × markupMultiplier, roundedCost + markupMin)
 * 3. branch = "×3" if (roundedCost × markupMultiplier < roundedCost + markupMin), else "+N"
 * 4. For each tier — FIRST discount, THEN VAT:
 *    - ×3 branch: priceWithoutVAT = basePrice × coefficient
 *    - +N branch: priceWithoutVAT = basePrice + correction (rubles)
 * 5. priceWithVAT = round(priceWithoutVAT × (1 + taxRate))  [rounding #2 — financial]
 * 6. finalPrice = applyPriceList(priceWithVAT, priceListPrice)
 * 7. withoutVAT (display) = priceWithoutVAT rounded to 2 decimals  [rounding #3 — display only]
 *
 * Key: discounts are applied to the pre-VAT price, NOT to the price with VAT.
 */
@Service
public class PriceCalculator {

    // Tier definitions: label, representative qty (unchanged from HTML prototype)
    private static final Tier[] TIERS = {
            new Tier("до 9", 5),
            new Tier("10–49", 30),
            new Tier("50–199", 100),
            new Tier("200–499", 300),
            new Tier("500–699", 600),
            new Tier("700–1499", 1000),
            new Tier("от 1500", 2000)
    };

    private final PricingConfig config;

    /** Valid tier labels — used for price list key validation. */
    public static List<String> tierLabels() {
        return java.util.Arrays.stream(TIERS).map(t -> t.label).toList();
    }

    public PriceCalculator(PricingConfig config) {
        this.config = config;
    }

    /**
     * Get the configured tax rate (for external use, e.g. display).
     */
    public BigDecimal getTaxRate() {
        return config.getTaxRate();
    }

    /**
     * Get the configured VAT multiplier (1 + taxRate).
     */
    public BigDecimal getVatMultiplier() {
        return BigDecimal.ONE.add(config.getTaxRate());
    }

    /**
     * Calculate base price = MIN(roundedCost × markupMultiplier, roundedCost + margin).
     * Uses configured margin (markupMin) by default.
     */
    public BigDecimal calcBasePrice(BigDecimal roundedCost) {
        return calcBasePrice(roundedCost, null);
    }

    /**
     * Calculate base price with user-defined margin ("плечо").
     * If marginValue is null, the configured markupMin is used.
     */
    public BigDecimal calcBasePrice(BigDecimal roundedCost, BigDecimal marginValue) {
        BigDecimal margin = marginValue != null ? marginValue : config.getMarkupMin();
        BigDecimal option1 = roundedCost.multiply(config.getMarkupMultiplier());
        BigDecimal option2 = roundedCost.add(margin);
        return option1.compareTo(option2) <= 0 ? option1 : option2;
    }

    /**
     * Determine the branch: "×3" or "+N" based on which option gives a lower base price.
     * Uses configured margin (markupMin) by default.
     */
    public String getBranch(BigDecimal roundedCost) {
        return getBranch(roundedCost, null);
    }

    /**
     * Determine the branch with user-defined margin ("плечо").
     */
    public String getBranch(BigDecimal roundedCost, BigDecimal marginValue) {
        BigDecimal margin = marginValue != null ? marginValue : config.getMarkupMin();
        BigDecimal option1 = roundedCost.multiply(config.getMarkupMultiplier());
        BigDecimal option2 = roundedCost.add(margin);
        return option1.compareTo(option2) < 0 ? "×3" : "+" + margin.toBigInteger();
    }

    /**
     * Generate price rows for all 7 tiers.
     *
     * @param roundedCost total cost rounded to integer
     * @param priceList   map of tier label → price list value (0 = not set)
     * @return list of price rows
     */
    public List<PriceRow> generatePrices(BigDecimal roundedCost, Map<String, BigDecimal> priceList) {
        return generatePrices(roundedCost, priceList, null);
    }

    /**
     * Generate price rows for all 7 tiers with user-defined margin ("плечо").
     *
     * @param roundedCost total cost rounded to integer
     * @param priceList   map of tier label → price list value (0 = not set)
     * @param marginValue user-defined margin; null → configured markupMin
     * @return list of price rows
     */
    public List<PriceRow> generatePrices(BigDecimal roundedCost, Map<String, BigDecimal> priceList, BigDecimal marginValue) {
        BigDecimal basePrice = calcBasePrice(roundedCost, marginValue);
        String branch = getBranch(roundedCost, marginValue);
        BigDecimal vatMultiplier = getVatMultiplier();

        List<PriceRow> rows = new ArrayList<>();

        for (Tier tier : TIERS) {
            BigDecimal priceWithoutVAT;

            if ("×3".equals(branch)) {
                priceWithoutVAT = basePrice.multiply(x3Coefficient(tier.label));
            } else {
                priceWithoutVAT = basePrice.add(discountStep(tier.label));
            }

            // Rounding #2: price with VAT → integer
            BigDecimal priceWithVATDecimal = priceWithoutVAT.multiply(vatMultiplier);
            int priceWithVAT = priceWithVATDecimal.setScale(0, RoundingMode.HALF_UP).intValue();

            // Rounding #3: withoutVAT for display → 2 decimals
            BigDecimal withoutVATDisplay = priceWithoutVAT.setScale(2, RoundingMode.HALF_UP);

            // Price list comparison
            BigDecimal plPrice = priceList != null ? priceList.getOrDefault(tier.label, BigDecimal.ZERO) : BigDecimal.ZERO;
            int priceListPrice = plPrice != null ? plPrice.intValue() : 0;
            int finalPrice = applyPriceList(priceWithVAT, priceListPrice);
            boolean isPriceListUsed = priceListPrice > 0 && priceWithVAT < priceListPrice;

            rows.add(new PriceRow(
                    tier.label,
                    withoutVATDisplay,
                    priceWithVAT,
                    priceListPrice,
                    finalPrice,
                    tier.qty == 30,  // base tier is 10–49
                    isPriceListUsed
            ));
        }

        return rows;
    }

    /**
     * If price list is set (>0) and calculated price is lower → use price list.
     * Otherwise → use calculated price.
     */
    private int applyPriceList(int calculatedPrice, int priceListPrice) {
        if (priceListPrice > 0 && calculatedPrice < priceListPrice) {
            return priceListPrice;
        }
        return calculatedPrice;
    }

    private BigDecimal x3Coefficient(String tierLabel) {
        BigDecimal value = config.getX3Coefficients().get(tierLabel);
        if (value == null) {
            throw new IllegalStateException(
                    "Missing x3 coefficient for tier '" + tierLabel + "' in app.pricing.x3-coefficients");
        }
        return value;
    }

    private BigDecimal discountStep(String tierLabel) {
        BigDecimal value = config.getDiscountSteps().get(tierLabel);
        if (value == null) {
            throw new IllegalStateException(
                    "Missing discount step for tier '" + tierLabel + "' in app.pricing.discount-steps");
        }
        return value;
    }

    // --- Inner types ---

    private static class Tier {
        final String label;
        final int qty;

        Tier(String label, int qty) {
            this.label = label;
            this.qty = qty;
        }
    }

    @Data
    public static class PriceRow {
        private final String label;
        private final BigDecimal withoutVAT;
        private final int calculatedPrice;
        private final int priceListPrice;
        private final int finalPrice;
        private final boolean isBase;
        private final boolean isPriceListUsed;

        public PriceRow(String label, BigDecimal withoutVAT, int calculatedPrice,
                        int priceListPrice, int finalPrice, boolean isBase, boolean isPriceListUsed) {
            this.label = label;
            this.withoutVAT = withoutVAT;
            this.calculatedPrice = calculatedPrice;
            this.priceListPrice = priceListPrice;
            this.finalPrice = finalPrice;
            this.isBase = isBase;
            this.isPriceListUsed = isPriceListUsed;
        }
    }
}
