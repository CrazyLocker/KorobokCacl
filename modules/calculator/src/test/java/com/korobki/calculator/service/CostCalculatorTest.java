package com.korobki.calculator.service;

import com.korobki.core.config.PricingConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CostCalculatorTest {

    /** BigDecimal equality that ignores scale (22.5 == 22.5000000000) */
    private static void assertBD(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                "Expected " + expected + " but got " + actual);
    }

    private PrintCostCalculator printCostCalculator;
    private PricingConfig pricingConfig;
    private CostCalculator costCalculator;

    @BeforeEach
    void setUp() {
        printCostCalculator = mock(PrintCostCalculator.class);
        pricingConfig = new PricingConfig();
        pricingConfig.setManufacturingCost(new BigDecimal("5.0"));
        costCalculator = new CostCalculator(printCostCalculator, pricingConfig);
    }

    @Test
    void singleDetail_materialPlusWork() {
        // sheetPrice=35, countOnSheet=2, workPrice=5
        // cost = 35/2 + 5 = 17.5 + 5 = 22.5
        CostCalculator.DetailInfo detail = new CostCalculator.DetailInfo();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("2"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(detail),
                Collections.emptyList(),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("22.5", total);
    }

    @Test
    void multipleDetails_summed() {
        // Detail 1: 35/2 + 5 = 22.5
        // Detail 2: 35/4 + 5 = 8.75 + 5 = 13.75
        // Total = 36.25
        CostCalculator.DetailInfo d1 = new CostCalculator.DetailInfo();
        d1.setName("Дно");
        d1.setCountOnSheet(new BigDecimal("2"));
        d1.setSheetPrice(new BigDecimal("35"));
        d1.setEnabled(true);

        CostCalculator.DetailInfo d2 = new CostCalculator.DetailInfo();
        d2.setName("Крышка");
        d2.setCountOnSheet(new BigDecimal("4"));
        d2.setSheetPrice(new BigDecimal("35"));
        d2.setEnabled(true);

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(d1, d2),
                Collections.emptyList(),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("36.25", total);
    }

    @Test
    void disabledDetail_skipped() {
        CostCalculator.DetailInfo d1 = new CostCalculator.DetailInfo();
        d1.setName("Дно");
        d1.setCountOnSheet(new BigDecimal("2"));
        d1.setSheetPrice(new BigDecimal("35"));
        d1.setEnabled(true);

        CostCalculator.DetailInfo d2 = new CostCalculator.DetailInfo();
        d2.setName("Крышка");
        d2.setCountOnSheet(new BigDecimal("4"));
        d2.setSheetPrice(new BigDecimal("35"));
        d2.setEnabled(false); // disabled

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(d1, d2),
                Collections.emptyList(),
                false, null, null,
                new BigDecimal("5")
        );

        // Only d1: 35/2 + 5 = 22.5
        assertBD("22.5", total);
    }

    @Test
    void zeroCountOnSheet_skipped() {
        CostCalculator.DetailInfo d1 = new CostCalculator.DetailInfo();
        d1.setName("Дно");
        d1.setCountOnSheet(new BigDecimal("0")); // zero → skipped
        d1.setSheetPrice(new BigDecimal("35"));
        d1.setEnabled(true);

        CostCalculator.DetailInfo d2 = new CostCalculator.DetailInfo();
        d2.setName("Крышка");
        d2.setCountOnSheet(new BigDecimal("4"));
        d2.setSheetPrice(new BigDecimal("35"));
        d2.setEnabled(true);

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(d1, d2),
                Collections.emptyList(),
                false, null, null,
                new BigDecimal("5")
        );

        // Only d2: 35/4 + 5 = 13.75
        assertBD("13.75", total);
    }

    @Test
    void operations_standardAndCustom_viaUnifiedMap() {
        // cost = 35/2 + 5 + 20(лак) + 30(конгрев) + 10(тиснение) + 15(ламинация) = 22.5 + 75 = 97.5
        CostCalculator.DetailInfo detail = new CostCalculator.DetailInfo();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("2"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);
        detail.setOperations(Map.of(
                "Лак", true,
                "Конгрев", true,
                "Тиснение", true,
                "Ламинация", true
        ));

        CostCalculator.ExtraInfo lak = new CostCalculator.ExtraInfo();
        lak.setName("Лак");
        lak.setCost(new BigDecimal("20"));

        CostCalculator.ExtraInfo congrev = new CostCalculator.ExtraInfo();
        congrev.setName("Конгрев");
        congrev.setCost(new BigDecimal("30"));

        CostCalculator.ExtraInfo tisnenie = new CostCalculator.ExtraInfo();
        tisnenie.setName("Тиснение");
        tisnenie.setCost(new BigDecimal("10"));

        CostCalculator.ExtraInfo lamination = new CostCalculator.ExtraInfo();
        lamination.setName("Ламинация");
        lamination.setCost(new BigDecimal("15"));

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(detail),
                List.of(lak, congrev, tisnenie, lamination),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("97.5", total);
    }

    @Test
    void printCost_addedPerPrintedDetail() {
        // printPerUnit = 55 (5500/100)
        // detail cost = 35/2 + 5 + 55 = 17.5 + 5 + 55 = 77.5
        when(printCostCalculator.calcPrintPerUnitNoVat(1, 100))
                .thenReturn(new BigDecimal("55"));

        CostCalculator.DetailInfo detail = new CostCalculator.DetailInfo();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("2"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);
        detail.setIsPrinted(true);

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(detail),
                Collections.emptyList(),
                true, 1, 100,
                new BigDecimal("5")
        );

        assertBD("77.5", total);
    }

    @Test
    void printCost_twoPrintedDetails_doubles() {
        // printPerUnit = 55
        // d1: 35/2 + 5 + 55 = 77.5
        // d2: 35/4 + 5 + 55 = 68.75
        // Total = 146.25
        when(printCostCalculator.calcPrintPerUnitNoVat(1, 100))
                .thenReturn(new BigDecimal("55"));

        CostCalculator.DetailInfo d1 = new CostCalculator.DetailInfo();
        d1.setName("Дно");
        d1.setCountOnSheet(new BigDecimal("2"));
        d1.setSheetPrice(new BigDecimal("35"));
        d1.setEnabled(true);
        d1.setIsPrinted(true);

        CostCalculator.DetailInfo d2 = new CostCalculator.DetailInfo();
        d2.setName("Крышка");
        d2.setCountOnSheet(new BigDecimal("4"));
        d2.setSheetPrice(new BigDecimal("35"));
        d2.setEnabled(true);
        d2.setIsPrinted(true);

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(d1, d2),
                Collections.emptyList(),
                true, 1, 100,
                new BigDecimal("5")
        );

        assertBD("146.25", total);
    }

    @Test
    void customOperation_perDetail_enabled() {
        // detail: 35/2 + 5 = 22.5
        // custom operation "УФ-лак" (enabled in operations map): +15
        // Total = 37.5
        CostCalculator.DetailInfo detail = new CostCalculator.DetailInfo();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("2"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);
        detail.setOperations(Map.of("УФ-лак", true));

        CostCalculator.ExtraInfo customOp = new CostCalculator.ExtraInfo();
        customOp.setName("УФ-лак");
        customOp.setCost(new BigDecimal("15"));

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(detail),
                List.of(customOp),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("37.5", total);
    }

    @Test
    void customOperation_perDetail_disabled() {
        // detail: 35/2 + 5 = 22.5
        // custom operation "УФ-лак" (disabled in operations map): not added
        // Total = 22.5
        CostCalculator.DetailInfo detail = new CostCalculator.DetailInfo();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("2"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);
        detail.setOperations(Map.of("УФ-лак", false));

        CostCalculator.ExtraInfo customOp = new CostCalculator.ExtraInfo();
        customOp.setName("УФ-лак");
        customOp.setCost(new BigDecimal("15"));

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(detail),
                List.of(customOp),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("22.5", total);
    }

    @Test
    void multipleOperations_mixedEnabledDisabled() {
        // detail: 35/2 + 5 = 22.5
        // operation "Оп1" (enabled): +15
        // operation "Оп2" (disabled): +0
        // operation "Оп3" (enabled): +8
        // Total = 22.5 + 15 + 8 = 45.5
        CostCalculator.DetailInfo detail = new CostCalculator.DetailInfo();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("2"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);
        detail.setOperations(Map.of(
                "Оп1", true,
                "Оп2", false,
                "Оп3", true
        ));

        CostCalculator.ExtraInfo op1 = new CostCalculator.ExtraInfo();
        op1.setName("Оп1");
        op1.setCost(new BigDecimal("15"));

        CostCalculator.ExtraInfo op2 = new CostCalculator.ExtraInfo();
        op2.setName("Оп2");
        op2.setCost(new BigDecimal("20"));

        CostCalculator.ExtraInfo op3 = new CostCalculator.ExtraInfo();
        op3.setName("Оп3");
        op3.setCost(new BigDecimal("8"));

        BigDecimal total = costCalculator.calculateTotalCost(
                List.of(detail),
                List.of(op1, op2, op3),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("45.5", total);
    }

    @Test
    void emptyDetails_returnsZero() {
        BigDecimal total = costCalculator.calculateTotalCost(
                Collections.emptyList(),
                Collections.emptyList(),
                false, null, null,
                new BigDecimal("5")
        );

        assertBD("0", total);
    }
}
