package com.korobki.calculator.service;

import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.PrintTableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link PrintCostCalculator}.
 * Verifies step-based pricing, the "first step with minQty >= quantity" rule,
 * the fallback below/above the table, and the >= 3000 linear extrapolation.
 */
class PrintCostCalculatorTest {

    /** BigDecimal equality that ignores scale (55 == 55.0000000000). */
    private static void assertBD(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                "Expected " + expected + " but got " + actual);
    }

    private PrintTableRepository printTableRepository;
    private PrintCostCalculator calculator;

    @BeforeEach
    void setUp() {
        printTableRepository = mock(PrintTableRepository.class);
        calculator = new PrintCostCalculator(printTableRepository);
    }

    /** Builds a print table with the given steps and post-3000 increment. */
    private PrintTable table(int formatId, String stepAfter3000, Object[][] steps) {
        PrintTable t = new PrintTable();
        t.setFormatId(formatId);
        t.setFormatName("Format " + formatId);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object[] s : steps) {
            list.add(Map.of("minQty", s[0], "price", s[1]));
        }
        t.setSteps(list);
        t.setStepAfter3000(new BigDecimal(stepAfter3000));
        return t;
    }

    private void stub(int formatId, PrintTable t) {
        when(printTableRepository.findByFormatId(formatId)).thenReturn(Optional.of(t));
    }

    // --- calcPrintCost: step selection ---

    @Test
    void quantityExactlyOnStep_returnsThatStepPrice() {
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {300, 12000}, {500, 18000}
        }));

        assertBD("5500", calculator.calcPrintCost(1, 100));
    }

    @Test
    void quantityBetweenSteps_returnsNextStepPrice() {
        // 200 → first step with minQty >= 200 is 300 → 12000
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {300, 12000}, {500, 18000}
        }));

        assertBD("12000", calculator.calcPrintCost(1, 200));
    }

    @Test
    void quantityBelowFirstStep_returnsFirstStepPrice() {
        // 50 → first step with minQty >= 50 is 100 → 5500
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {300, 12000}
        }));

        assertBD("5500", calculator.calcPrintCost(1, 50));
    }

    @Test
    void quantityAboveLastStepBelow3000_fallsBackToFirstStep() {
        // 2500 → no step has minQty >= 2500 → fallback to first step price
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {2000, 30000}
        }));

        assertBD("5500", calculator.calcPrintCost(1, 2500));
    }

    // --- calcPrintCost: >= 3000 extrapolation ---

    @Test
    void quantityExactly3000_noExtraThousands() {
        // ceil((3000-3000)/1000) = 0 → last price only
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {3000, 30000}
        }));

        assertBD("30000", calculator.calcPrintCost(1, 3000));
    }

    @Test
    void quantity4000_addsOneIncrement() {
        // ceil((4000-3000)/1000) = 1 → 30000 + 1500
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {3000, 30000}
        }));

        assertBD("31500", calculator.calcPrintCost(1, 4000));
    }

    @Test
    void quantity5500_roundsUpToThreeIncrements() {
        // ceil((5500-3000)/1000) = ceil(2.5) = 3 → 30000 + 3*1500
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {3000, 30000}
        }));

        assertBD("34500", calculator.calcPrintCost(1, 5500));
    }

    // --- calcPrintCost: missing data ---

    @Test
    void formatNotFound_returnsZero() {
        when(printTableRepository.findByFormatId(99)).thenReturn(Optional.empty());

        assertBD("0", calculator.calcPrintCost(99, 100));
    }

    @Test
    void emptySteps_returnsZero() {
        PrintTable t = new PrintTable();
        t.setFormatId(1);
        t.setSteps(new ArrayList<>());
        t.setStepAfter3000(new BigDecimal("1500"));
        stub(1, t);

        assertBD("0", calculator.calcPrintCost(1, 100));
    }

    @Test
    void nullSteps_returnsZero() {
        PrintTable t = new PrintTable();
        t.setFormatId(1);
        t.setSteps(null);
        t.setStepAfter3000(new BigDecimal("1500"));
        stub(1, t);

        assertBD("0", calculator.calcPrintCost(1, 100));
    }

    // --- calcPrintPerUnitNoVat ---

    @Test
    void perUnit_dividesTotalByQuantity() {
        // pps = 1: rawSheets = 100; 5500 / 100 / 1 = 55
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {300, 12000}
        }));

        assertBD("55", calculator.calcPrintPerUnitNoVat(1, 100, 1));
    }

    @Test
    void perUnit_dividesByRawSheetsAndPartsPerSheet() {
        // pps = 2: rawSheets = ceil(100 / 2) = 50; 5500 / 100 / 2 = 27.50
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}, {300, 12000}
        }));

        assertBD("27.5", calculator.calcPrintPerUnitNoVat(1, 100, 2));
    }

    @Test
    void perUnit_nullPartsPerSheet_defaultsToOne() {
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}
        }));

        assertBD("55", calculator.calcPrintPerUnitNoVat(1, 100, null));
    }

    @Test
    void perUnit_zeroPartsPerSheet_defaultsToOne() {
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}
        }));

        assertBD("55", calculator.calcPrintPerUnitNoVat(1, 100, 0));
    }

    @Test
    void perUnit_partsPerSheetGreaterThanBoxCount_returnsZero() {
        // Prototype validatePrint() blocks this case; the calculator returns 0.
        stub(1, table(1, "1500", new Object[][]{
                {100, 5500}
        }));

        assertBD("0", calculator.calcPrintPerUnitNoVat(1, 100, 101));
    }

    @Test
    void perUnit_zeroQuantity_returnsZero() {
        assertBD("0", calculator.calcPrintPerUnitNoVat(1, 0, 1));
    }

    @Test
    void perUnit_nullQuantity_returnsZero() {
        assertBD("0", calculator.calcPrintPerUnitNoVat(1, null, 1));
    }

    @Test
    void perUnit_negativeQuantity_returnsZero() {
        assertBD("0", calculator.calcPrintPerUnitNoVat(1, -5, 1));
    }

    // --- calcAssemblyRun / calcAssemblyPerPartNoVat ---

    @Test
    void assembly_oneSetPerSheet_usesTariffOfNextStep() {
        // 200 коробок, лист = 3 детали при 3 деталях в коробке → 1 комплект,
        // 200 листов → тариф 300 (7500) → 25 ₽/лист → 25/3 ₽ за деталь
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {300, 7500}, {500, 9000}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 200, 3, 3);

        assertEquals(200, run.sheets());
        assertEquals(300, run.tariffSheets());
        assertBD("7500", run.bill());
        assertBD("25", run.pricePerSheet());
        assertBD("8.3333333333", run.pricePerPart());
        assertBD("8.3333333333", calculator.calcAssemblyPerPartNoVat(1, 200, 3, 3));
    }

    @Test
    void assembly_twoSetsPerSheet_halvesTheSheetCount() {
        // 6 деталей на листе при 3 в коробке → 2 комплекта → 200 коробок = 100 листов
        stub(1, table(1, "1500", new Object[][]{{100, 6000}, {300, 7500}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 200, 6, 3);

        assertEquals(100, run.sheets());
        assertEquals(100, run.tariffSheets());
        assertBD("60", run.pricePerSheet());
        assertBD("10", run.pricePerPart());
    }

    @Test
    void assembly_partialSetPerSheet_roundsSheetCountUp() {
        // 2 детали на листе при 3 в коробке → 2/3 комплекта →
        // ceil(200 * 3 / 2) = 300 листов → тариф 300
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {300, 7500}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 200, 2, 3);

        assertEquals(300, run.sheets());
        assertEquals(300, run.tariffSheets());
        assertBD("25", run.pricePerSheet());
        assertBD("12.5", run.pricePerPart());
    }

    @Test
    void assembly_belowFirstStep_usesFirstStepTariff() {
        // 20 коробок → 20 листов → первая ступень 100 (5500) → 55 ₽/лист
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {300, 7500}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 20, 3, 3);

        assertEquals(20, run.sheets());
        assertEquals(100, run.tariffSheets());
        assertBD("55", run.pricePerSheet());
    }

    @Test
    void assembly_above3000_addsIncrements() {
        // 4000 коробок → 4000 листов → 30000 + 1 * 1500 при тарифе 3000
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {3000, 30000}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 4000, 3, 3);

        assertEquals(4000, run.sheets());
        assertEquals(3000, run.tariffSheets());
        assertBD("31500", run.bill());
        assertBD("10.5", run.pricePerSheet());
        assertBD("3.5", run.pricePerPart());
    }

    @Test
    void assembly_missingTable_returnsZero() {
        when(printTableRepository.findByFormatId(99)).thenReturn(Optional.empty());

        assertBD("0", calculator.calcAssemblyPerPartNoVat(99, 200, 3, 3));
        assertEquals(0, calculator.calcAssemblyRun(99, 200, 3, 3).sheets());
    }

    @Test
    void assembly_invalidInput_returnsZero() {
        stub(1, table(1, "1500", new Object[][]{{100, 5500}}));

        assertBD("0", calculator.calcAssemblyPerPartNoVat(null, 200, 3, 3));
        assertBD("0", calculator.calcAssemblyPerPartNoVat(1, null, 3, 3));
        assertBD("0", calculator.calcAssemblyPerPartNoVat(1, 0, 3, 3));
        assertBD("0", calculator.calcAssemblyPerPartNoVat(1, 200, null, 3));
        assertBD("0", calculator.calcAssemblyPerPartNoVat(1, 200, 0, 3));
        assertBD("0", calculator.calcAssemblyPerPartNoVat(1, 200, 3, null));
        assertBD("0", calculator.calcAssemblyPerPartNoVat(1, 200, 3, 0));
    }
}
