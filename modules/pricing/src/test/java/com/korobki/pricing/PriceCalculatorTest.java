package com.korobki.pricing;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PriceCalculatorTest {

    private final PriceCalculator calculator = new PriceCalculator();

    // === Branch selection ===

    @Test
    void branch_x3_whenCostBelow15() {
        // cost=10: 10×3=30 < 10+30=40 → ×3
        assertEquals("×3", calculator.getBranch(new BigDecimal("10")));
    }

    @Test
    void branch_plus30_whenCostAbove15() {
        // cost=20: 20×3=60 > 20+30=50 → +30
        assertEquals("+30", calculator.getBranch(new BigDecimal("20")));
    }

    @Test
    void branch_plus30_whenCostEquals15() {
        // cost=15: 15×3=45 = 15+30=45 → +30 (equal goes to +30)
        assertEquals("+30", calculator.getBranch(new BigDecimal("15")));
    }

    // === Base price ===

    @Test
    void basePrice_x3_branch() {
        // cost=10: MIN(30, 40) = 30
        assertEquals(new BigDecimal("30"), calculator.calcBasePrice(new BigDecimal("10")));
    }

    @Test
    void basePrice_plus30_branch() {
        // cost=20: MIN(60, 50) = 50
        assertEquals(new BigDecimal("50"), calculator.calcBasePrice(new BigDecimal("20")));
    }

    // === Price generation: ×3 branch ===

    @Test
    void generatePrices_x3_branch_coefficients() {
        // cost=10 → roundedCost=10, basePrice=30, branch=×3
        BigDecimal roundedCost = new BigDecimal("10");
        Map<String, BigDecimal> priceList = new HashMap<>();
        // No price list → all zeros
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        assertEquals(7, rows.size());

        // Tier 10–49 (base): 30 × 1.0 = 30, withVAT = round(30 × 1.11) = round(33.3) = 33
        PriceCalculator.PriceRow baseRow = rows.get(1);
        assertTrue(baseRow.isBase());
        assertEquals(33, baseRow.getCalculatedPrice());
        assertEquals(33, baseRow.getFinalPrice());

        // Tier 50–199: 30 × 0.95 = 28.5, withVAT = round(28.5 × 1.11) = round(31.635) = 32
        PriceCalculator.PriceRow row50_199 = rows.get(2);
        assertEquals(32, row50_199.getCalculatedPrice());

        // Tier от 1500: 30 × 0.75 = 22.5, withVAT = round(22.5 × 1.11) = round(24.975) = 25
        PriceCalculator.PriceRow row1500 = rows.get(6);
        assertEquals(25, row1500.getCalculatedPrice());
    }

    // === Price generation: +30 branch ===

    @Test
    void generatePrices_plus30_branch_corrections() {
        // cost=20 → roundedCost=20, basePrice=50, branch=+30
        BigDecimal roundedCost = new BigDecimal("20");
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        assertEquals(7, rows.size());

        // Tier до 9: 50 + 7 = 57, withVAT = round(57 × 1.11) = round(63.27) = 63
        assertEquals(63, rows.get(0).getCalculatedPrice());

        // Tier 10–49 (base): 50 + 0 = 50, withVAT = round(50 × 1.11) = round(55.5) = 56
        assertTrue(rows.get(1).isBase());
        assertEquals(56, rows.get(1).getCalculatedPrice());

        // Tier 50–199: 50 + (-2) = 48, withVAT = round(48 × 1.11) = round(53.28) = 53
        assertEquals(53, rows.get(2).getCalculatedPrice());

        // Tier от 1500: 50 + (-10) = 40, withVAT = round(40 × 1.11) = round(44.4) = 44
        assertEquals(44, rows.get(6).getCalculatedPrice());
    }

    // === Price list comparison ===

    @Test
    void priceListUsed_whenCalculatedLowerThanPriceList() {
        BigDecimal roundedCost = new BigDecimal("20"); // basePrice=50, +30 branch
        Map<String, BigDecimal> priceList = new HashMap<>();
        priceList.put("до 9", BigDecimal.ZERO);
        priceList.put("10–49", new BigDecimal("60")); // calculated=56, priceList=60 → use 60
        priceList.put("50–199", BigDecimal.ZERO);
        priceList.put("200–499", BigDecimal.ZERO);
        priceList.put("500–699", BigDecimal.ZERO);
        priceList.put("700–1499", BigDecimal.ZERO);
        priceList.put("от 1500", BigDecimal.ZERO);

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        // Tier 10–49: calculated=56 < priceList=60 → finalPrice=60, isPriceListUsed=true
        PriceCalculator.PriceRow baseRow = rows.get(1);
        assertEquals(56, baseRow.getCalculatedPrice());
        assertEquals(60, baseRow.getPriceListPrice());
        assertEquals(60, baseRow.getFinalPrice());
        assertTrue(baseRow.isPriceListUsed());
    }

    @Test
    void priceListNotUsed_whenCalculatedHigherOrEqual() {
        BigDecimal roundedCost = new BigDecimal("20"); // basePrice=50, +30 branch
        Map<String, BigDecimal> priceList = new HashMap<>();
        priceList.put("до 9", BigDecimal.ZERO);
        priceList.put("10–49", new BigDecimal("50")); // calculated=56 > priceList=50 → use 56
        priceList.put("50–199", BigDecimal.ZERO);
        priceList.put("200–499", BigDecimal.ZERO);
        priceList.put("500–699", BigDecimal.ZERO);
        priceList.put("700–1499", BigDecimal.ZERO);
        priceList.put("от 1500", BigDecimal.ZERO);

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        PriceCalculator.PriceRow baseRow = rows.get(1);
        assertEquals(56, baseRow.getCalculatedPrice());
        assertEquals(50, baseRow.getPriceListPrice());
        assertEquals(56, baseRow.getFinalPrice());
        assertFalse(baseRow.isPriceListUsed());
    }

    @Test
    void priceListNotUsed_whenPriceListIsZero() {
        BigDecimal roundedCost = new BigDecimal("20");
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        for (PriceCalculator.PriceRow row : rows) {
            assertFalse(row.isPriceListUsed());
            assertEquals(row.getCalculatedPrice(), row.getFinalPrice());
        }
    }

    // === withoutVAT display rounding ===

    @Test
    void withoutVAT_displayRoundedTo2Decimals() {
        BigDecimal roundedCost = new BigDecimal("10"); // ×3 branch, basePrice=30
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        // Tier 50–199: 30 × 0.95 = 28.50 → withoutVAT = 28.50
        assertEquals(new BigDecimal("28.50"), rows.get(2).getWithoutVAT());

        // Tier 10–49: 30 × 1.0 = 30.00 → withoutVAT = 30.00
        assertEquals(new BigDecimal("30.00"), rows.get(1).getWithoutVAT());
    }

    // === Regression: discount applied BEFORE VAT (НК РФ) ===

    @Test
    void discountBeforeVAT_x3_branch_coefficientAppliedToPreVATPrice() {
        // cost=10 → basePrice=30, branch=×3
        // Tier 50–199, coefficient=0.95
        // CORRECT (discount → VAT):  30 × 0.95 = 28.5 → 28.5 × 1.11 = 31.635 → round = 32
        // WRONG   (VAT → discount):  30 × 1.11 = 33.3 → round(33) → 33 × 0.95 = 31.35 → round = 31
        BigDecimal roundedCost = new BigDecimal("10");
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        // Must be 32 (discount first), NOT 31 (VAT first)
        assertEquals(32, rows.get(2).getCalculatedPrice(),
                "×3 branch: coefficient must be applied BEFORE VAT (НК РФ)");
    }

    @Test
    void discountBeforeVAT_plus30_branch_correctionAppliedToPreVATPrice() {
        // cost=20 → basePrice=50, branch=+30
        // Tier 50–199, correction=-2
        // CORRECT (discount → VAT):  50 + (-2) = 48 → 48 × 1.11 = 53.28 → round = 53
        // WRONG   (VAT → discount):  50 × 1.11 = 55.5 → round(56) → 56 + (-2) = 54
        BigDecimal roundedCost = new BigDecimal("20");
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        // Must be 53 (discount first), NOT 54 (VAT first)
        assertEquals(53, rows.get(2).getCalculatedPrice(),
                "+30 branch: correction must be applied BEFORE VAT (НК РФ)");
    }

    @Test
    void discountBeforeVAT_x3_branch_largeCoefficientDifference() {
        // cost=10 → basePrice=30, branch=×3
        // Tier от 1500, coefficient=0.75
        // CORRECT (discount → VAT):  30 × 0.75 = 22.5 → 22.5 × 1.11 = 24.975 → round = 25
        // WRONG   (VAT → discount):  30 × 1.11 = 33.3 → round(33) → 33 × 0.75 = 24.75 → round = 25
        // In this case both give 25, so let's use a tier where they differ.
        // Tier 200–499, coefficient=0.90:
        // CORRECT: 30 × 0.90 = 27 → 27 × 1.11 = 29.97 → round = 30
        // WRONG:   30 × 1.11 = 33.3 → round(33) → 33 × 0.90 = 29.7 → round = 30
        // Also same! Let's try tier 500–699, coefficient=0.85:
        // CORRECT: 30 × 0.85 = 25.5 → 25.5 × 1.11 = 28.305 → round = 28
        // WRONG:   30 × 1.11 = 33.3 → round(33) → 33 × 0.85 = 28.05 → round = 28
        // Still same. The ×3 branch with basePrice=30 doesn't produce differences
        // for most tiers because the rounding converges. The 50–199 test above
        // (32 vs 31) is the key differentiator. This test documents that the
        // withoutVAT field reflects the pre-VAT discounted price.
        BigDecimal roundedCost = new BigDecimal("10");
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        // withoutVAT must be the pre-VAT discounted price (30 × 0.75 = 22.50)
        assertEquals(new BigDecimal("22.50"), rows.get(6).getWithoutVAT(),
                "withoutVAT must reflect pre-VAT price after coefficient, not post-VAT");
    }

    @Test
    void discountBeforeVAT_plus30_branch_allTiersPreVATPrices() {
        // cost=20 → basePrice=50, branch=+30
        // Verify withoutVAT for all tiers = basePrice + correction (pre-VAT)
        BigDecimal roundedCost = new BigDecimal("20");
        Map<String, BigDecimal> priceList = new HashMap<>();
        for (String label : new String[]{"до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"}) {
            priceList.put(label, BigDecimal.ZERO);
        }

        List<PriceCalculator.PriceRow> rows = calculator.generatePrices(roundedCost, priceList);

        // withoutVAT = basePrice + correction, BEFORE VAT
        assertEquals(new BigDecimal("57.00"), rows.get(0).getWithoutVAT()); // 50 + 7
        assertEquals(new BigDecimal("50.00"), rows.get(1).getWithoutVAT()); // 50 + 0
        assertEquals(new BigDecimal("48.00"), rows.get(2).getWithoutVAT()); // 50 - 2
        assertEquals(new BigDecimal("46.00"), rows.get(3).getWithoutVAT()); // 50 - 4
        assertEquals(new BigDecimal("44.00"), rows.get(4).getWithoutVAT()); // 50 - 6
        assertEquals(new BigDecimal("42.00"), rows.get(5).getWithoutVAT()); // 50 - 8
        assertEquals(new BigDecimal("40.00"), rows.get(6).getWithoutVAT()); // 50 - 10
    }
}
