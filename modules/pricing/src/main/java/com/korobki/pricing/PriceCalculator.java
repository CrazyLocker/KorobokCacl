package com.korobki.pricing;

import lombok.Data;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Price calculator — pure math, no DB dependencies.
 *
 * Algorithm (в соответствии с НК РФ: скидка → НДС):
 * 1. roundedCost = totalCost.setScale(0, HALF_UP)  [rounding #1 — done by caller]
 * 2. basePrice = MIN(roundedCost × 3, roundedCost + 30)
 * 3. branch = "×3" if (roundedCost × 3 < roundedCost + 30), else "+30"
 * 4. For each tier — FIRST discount, THEN VAT:
 *    - ×3 branch: priceWithoutVAT = basePrice × coefficient
 *    - +30 branch: priceWithoutVAT = basePrice + correction (rubles)
 * 5. priceWithVAT = round(priceWithoutVAT × 1.11)  [rounding #2 — financial, the only integer rounding]
 * 6. finalPrice = applyPriceList(priceWithVAT, priceListPrice)
 * 7. withoutVAT (display) = priceWithoutVAT rounded to 2 decimals  [rounding #3 — display only]
 *
 * Key: discounts are applied to the pre-VAT price, NOT to the price with VAT.
 */
@Service
public class PriceCalculator {

    public static final BigDecimal VAT_RATE = new BigDecimal("0.11");
    public static final BigDecimal VAT_MULTIPLIER = new BigDecimal("1.11");
    public static final BigDecimal MARKUP_MIN = new BigDecimal("30");
    public static final BigDecimal MARKUP_MULTIPLIER = new BigDecimal("3");

    // Tier definitions: label, representative qty
    private static final Tier[] TIERS = {
            new Tier("до 9", 5),
            new Tier("10–49", 30),
            new Tier("50–199", 100),
            new Tier("200–499", 300),
            new Tier("500–699", 600),
            new Tier("700–1499", 1000),
            new Tier("от 1500", 2000)
    };

    // ×3 branch coefficients
    private static final BigDecimal[] X3_COEFFICIENTS = {
            new BigDecimal("1.0"),    // до 9
            new BigDecimal("1.0"),    // 10–49
            new BigDecimal("0.95"),   // 50–199
            new BigDecimal("0.90"),   // 200–499
            new BigDecimal("0.85"),   // 500–699
            new BigDecimal("0.80"),   // 700–1499
            new BigDecimal("0.75")    // от 1500
    };

    // +30 branch corrections (rubles)
    private static final BigDecimal[] PLUS30_CORRECTIONS = {
            new BigDecimal("7"),      // до 9
            BigDecimal.ZERO,          // 10–49
            new BigDecimal("-2"),     // 50–199
            new BigDecimal("-4"),     // 200–499
            new BigDecimal("-6"),     // 500–699
            new BigDecimal("-8"),     // 700–1499
            new BigDecimal("-10")     // от 1500
    };

    /**
     * Calculate base price = MIN(roundedCost × 3, roundedCost + 30).
     */
    public BigDecimal calcBasePrice(BigDecimal roundedCost) {
        BigDecimal option1 = roundedCost.multiply(MARKUP_MULTIPLIER);
        BigDecimal option2 = roundedCost.add(MARKUP_MIN);
        return option1.compareTo(option2) <= 0 ? option1 : option2;
    }

    /**
     * Determine the branch: "×3" or "+30".
     */
    public String getBranch(BigDecimal roundedCost) {
        BigDecimal option1 = roundedCost.multiply(MARKUP_MULTIPLIER);
        BigDecimal option2 = roundedCost.add(MARKUP_MIN);
        return option1.compareTo(option2) < 0 ? "×3" : "+30";
    }

    /**
     * Generate price rows for all 7 tiers.
     *
     * @param roundedCost total cost rounded to integer
     * @param priceList   map of tier label → price list value (0 = not set)
     * @return list of price rows
     */
    public List<PriceRow> generatePrices(BigDecimal roundedCost, Map<String, BigDecimal> priceList) {
        BigDecimal basePrice = calcBasePrice(roundedCost);
        String branch = getBranch(roundedCost);

        List<PriceRow> rows = new ArrayList<>();

        for (int i = 0; i < TIERS.length; i++) {
            Tier tier = TIERS[i];
            BigDecimal priceWithoutVAT;

            if ("×3".equals(branch)) {
                priceWithoutVAT = basePrice.multiply(X3_COEFFICIENTS[i]);
            } else {
                priceWithoutVAT = basePrice.add(PLUS30_CORRECTIONS[i]);
            }

            // Rounding #2: price with VAT → integer
            BigDecimal priceWithVATDecimal = priceWithoutVAT.multiply(VAT_MULTIPLIER);
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
