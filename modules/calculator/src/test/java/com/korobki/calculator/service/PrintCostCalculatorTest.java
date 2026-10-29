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

    // --- calcAssemblyRun («Сборка на печатный лист») ---

    /** A detail with the given number of copies on one assembly sheet. */
    private static PrintCostCalculator.DetailSheet cols(String name, Integer cols) {
        return new PrintCostCalculator.DetailSheet(name, cols);
    }

    /** Steps used by the assembly tests: 100 → 5500, 300 → 7500, 500 → 9000. */
    private void stubAssemblySteps() {
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {300, 7500}, {500, 9000}}));
    }

    @Test
    void assembly_sheetsDrivenByTheDetailWithMostSheets() {
        // Дно 3/лист → ceil(200/3)=67 листов, крышка 1/лист → 200 листов.
        // Комплект печатается 200 листов → тариф 300 (7500); на листе 4 детали
        // → 7500 / 200 / 4 = 9.375 ₽ за деталь.
        stubAssemblySteps();

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 200,
                List.of(cols("Дно", 3), cols("Крышка", 1)));

        assertEquals(200, run.sheets());
        assertEquals(300, run.tariffSheets());
        assertBD("7500", run.bill());
        assertEquals(4, run.totalPartsOnSheet());
        assertBD("37.5", run.pricePerSheet());
        assertBD("9.375", run.pricePerPart());
        assertTrue(run.priced());
    }

    @Test
    void assembly_threeDetailsOneCopyEach_shareTheBillBetweenAllCopies() {
        // 100 комплектов, три детали по 1 копии → 100 листов → тариф 100 (5500)
        // → 55 ₽/лист → 55 / 3 ≈ 18.33 ₽ за деталь (одинаково для всех).
        stubAssemblySteps();

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 100,
                List.of(cols("Дно", 1), cols("Разделитель", 1), cols("Крышка", 1)));

        assertEquals(100, run.sheets());
        assertEquals(100, run.tariffSheets());
        assertBD("5500", run.bill());
        assertEquals(3, run.totalPartsOnSheet());
        assertBD("55", run.pricePerSheet());
        assertBD("18.3333333333", run.pricePerPart());
    }

    @Test
    void assembly_oneDetailOneCopy_isTheWholeBillPerCopy() {
        // 100 комплектов, одна деталь по 1 копии → 100 листов → 5500 / 100 = 55 ₽.
        stubAssemblySteps();

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 100,
                List.of(cols("Дно", 1)));

        assertEquals(100, run.sheets());
        assertEquals(1, run.totalPartsOnSheet());
        assertBD("55", run.pricePerSheet());
        assertBD("55", run.pricePerPart());
    }

    @Test
    void assembly_oneDetailThreeCopies_dividesByBothSheetsAndCopies() {
        // 200 комплектов, 3 копии на листе → ceil(200/3)=67 листов → 5500 / 67
        // = 82.0895522388 ₽/лист → / 3 копии = 27.3631840796 ₽ за копию.
        stubAssemblySteps();

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 200,
                List.of(cols("Дно", 3)));

        assertEquals(67, run.sheets());
        assertEquals(100, run.tariffSheets());
        assertBD("5500", run.bill());
        assertBD("82.0895522388", run.pricePerSheet());
        assertBD("27.3631840796", run.pricePerPart());
    }

    @Test
    void assembly_belowFirstStep_usesFirstStepTariff() {
        // 20 комплектов → 20 листов → первая ступень 100 (5500) → 275 ₽/лист.
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {300, 7500}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 20,
                List.of(cols("Дно", 1)));

        assertEquals(20, run.sheets());
        assertEquals(100, run.tariffSheets());
        assertBD("275", run.pricePerSheet());
        assertBD("275", run.pricePerPart());
    }

    @Test
    void assembly_above3000_addsIncrements() {
        // 4000 комплектов → 4000 листов → 30000 + 1 * 1500 при тарифе 3000.
        stub(1, table(1, "1500", new Object[][]{{100, 5500}, {3000, 30000}}));

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 4000,
                List.of(cols("Дно", 1)));

        assertEquals(4000, run.sheets());
        assertEquals(3000, run.tariffSheets());
        assertBD("31500", run.bill());
        assertBD("7.875", run.pricePerSheet());
        assertBD("7.875", run.pricePerPart());
    }

    @Test
    void assembly_nullColsOnSheet_meansOneCopy() {
        // null — legacy-запрос без «кол-ва на лист»; 1 копия.
        stubAssemblySteps();

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(1, 200,
                List.of(cols("Дно", null)));

        assertEquals(200, run.sheets());
        assertEquals(1, run.totalPartsOnSheet());
        assertBD("37.5", run.pricePerPart());
    }

    @Test
    void assembly_zeroOrNegativeColsOnSheet_isSkipped() {
        // Явный 0/отрицательное значение отклоняется валидацией сервиса;
        // калькулятор не роняет весь прогон из-за одной такой детали.
        stubAssemblySteps();

        PrintCostCalculator.AssemblyRun onlyInvalid = calculator.calcAssemblyRun(1, 100,
                List.of(cols("Дно", 0)));
        assertEquals(0, onlyInvalid.sheets());
        assertFalse(onlyInvalid.priced());

        PrintCostCalculator.AssemblyRun mixed = calculator.calcAssemblyRun(1, 100,
                List.of(cols("Дно", 0), cols("Крышка", 1)));
        assertEquals(100, mixed.sheets());
        assertEquals(1, mixed.totalPartsOnSheet());
        assertBD("55", mixed.pricePerPart());
    }

    @Test
    void assembly_missingTable_returnsEmpty() {
        when(printTableRepository.findByFormatId(99)).thenReturn(Optional.empty());

        PrintCostCalculator.AssemblyRun run = calculator.calcAssemblyRun(99, 200,
                List.of(cols("Дно", 1)));

        assertEquals(0, run.sheets());
        assertBD("0", run.pricePerPart());
        assertFalse(run.priced());
    }

    @Test
    void assembly_invalidInput_returnsEmpty() {
        stubAssemblySteps();

        assertEquals(0, calculator.calcAssemblyRun(null, 200, List.of(cols("Дно", 1))).sheets());
        assertEquals(0, calculator.calcAssemblyRun(1, null, List.of(cols("Дно", 1))).sheets());
        assertEquals(0, calculator.calcAssemblyRun(1, 0, List.of(cols("Дно", 1))).sheets());
        assertEquals(0, calculator.calcAssemblyRun(1, -5, List.of(cols("Дно", 1))).sheets());
        assertEquals(0, calculator.calcAssemblyRun(1, 200, List.of()).sheets());
        assertEquals(0, calculator.calcAssemblyRun(1, 200, null).sheets());
    }
}
