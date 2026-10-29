package com.korobki.api.controller;

import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.DetailDto;
import com.korobki.calculator.service.CostCalculator;
import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.pricing.PriceCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SuppressWarnings("deprecation") // legacy assembly response fields
class CalculatorServiceValidationTest {

    private CalculatorService service;
    private CostCalculator costCalculator;
    private PriceCalculator priceCalculator;
    private PrintCostCalculator printCostCalculator;

    @BeforeEach
    void setUp() {
        costCalculator = org.mockito.Mockito.mock(CostCalculator.class);
        priceCalculator = org.mockito.Mockito.mock(PriceCalculator.class);
        printCostCalculator = org.mockito.Mockito.mock(PrintCostCalculator.class);

        // Stub the math so requests that pass validation complete without NPE
        org.mockito.Mockito.when(costCalculator.calculateTotalCost(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(BigDecimal.TEN);
        org.mockito.Mockito.when(costCalculator.getDefaultWorkPrice()).thenReturn(new BigDecimal("5"));
        org.mockito.Mockito.when(priceCalculator.generatePrices(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.List.of());
        org.mockito.Mockito.when(priceCalculator.generatePrices(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.List.of());
        org.mockito.Mockito.when(priceCalculator.calcBasePrice(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(BigDecimal.TEN);
        org.mockito.Mockito.when(priceCalculator.calcBasePrice(org.mockito.ArgumentMatchers.any()))
                .thenReturn(BigDecimal.TEN);
        org.mockito.Mockito.when(priceCalculator.getBranch(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn("+30");
        org.mockito.Mockito.when(priceCalculator.getBranch(org.mockito.ArgumentMatchers.any()))
                .thenReturn("+30");
        org.mockito.Mockito.when(priceCalculator.getVatMultiplier()).thenReturn(new BigDecimal("1.11"));

        service = new CalculatorService(costCalculator, priceCalculator, printCostCalculator);
    }

    private CalculationRequest validRequest() {
        CalculationRequest request = new CalculationRequest();
        request.setConstruction("Тест");
        request.setWorkPrice(BigDecimal.TEN);

        DetailDto detail = new DetailDto();
        detail.setName("Дно");
        detail.setCountOnSheet(new BigDecimal("4"));
        detail.setSheetPrice(new BigDecimal("35"));
        detail.setEnabled(true);
        request.setDetails(java.util.List.of(detail));

        return request;
    }

    @Test
    void validRequest_passesValidation() {
        assertDoesNotThrow(() -> service.calculate(validRequest()));
    }

    @Test
    void totalCost_isRoundedToKopecksBeforeWholeRubles() {
        // scale=10 material division can produce 92.4999999999 instead of 92.5.
        // The service must round to kopecks first, then to whole rubles (93).
        org.mockito.Mockito.when(costCalculator.calculateTotalCost(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(new BigDecimal("92.4999999999"));
        org.mockito.Mockito.when(priceCalculator.calcBasePrice(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CalculationResponse response = service.calculate(validRequest());

        assertEquals(0, new BigDecimal("93").compareTo(response.getBasePrice()));
    }

    @Test
    void enabledDetail_withZeroCountOnSheet_rejected() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setCountOnSheet(BigDecimal.ZERO);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("countOnSheet must be > 0"));
    }

    @Test
    void disabledDetail_withZeroCountOnSheet_allowed() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setEnabled(false);
        request.getDetails().get(0).setCountOnSheet(BigDecimal.ZERO);

        assertDoesNotThrow(() -> service.calculate(request));
    }

    @Test
    void negativeSheetPrice_rejected() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setSheetPrice(new BigDecimal("-5"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("sheetPrice must be >= 0"));
    }

    @Test
    void unknownPriceListTier_rejected() {
        CalculationRequest request = validRequest();
        Map<String, BigDecimal> priceList = new HashMap<>();
        priceList.put("несуществующая ступень", new BigDecimal("100"));
        request.setPriceList(priceList);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("Unknown price list tier"));
    }

    @Test
    void validPriceListTier_accepted() {
        CalculationRequest request = validRequest();
        Map<String, BigDecimal> priceList = new HashMap<>();
        priceList.put("10–49", new BigDecimal("100"));
        request.setPriceList(priceList);

        assertDoesNotThrow(() -> service.calculate(request));
    }

    @Test
    void enabledPrintSettings_withZeroQuantity_rejected() {
        CalculationRequest request = validRequest();
        com.korobki.api.dto.PrintSettingsDto ps = new com.korobki.api.dto.PrintSettingsDto();
        ps.setEnabled(true);
        ps.setFormat(1);
        ps.setQuantity(0);
        request.setPrintSettings(ps);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("quantity must be > 0"));
    }

    @Test
    void enabledPrintSettings_withMissingFormat_rejected() {
        CalculationRequest request = validRequest();
        com.korobki.api.dto.PrintSettingsDto ps = new com.korobki.api.dto.PrintSettingsDto();
        ps.setEnabled(true);
        ps.setQuantity(100);
        request.setPrintSettings(ps);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("format is missing"));
    }

    @Test
    void printedDetail_withPartsPerSheetGreaterThanQuantity_rejected() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setIsPrinted(true);
        request.getDetails().get(0).setPartsPerSheetOnPrint(101);

        com.korobki.api.dto.PrintSettingsDto ps = new com.korobki.api.dto.PrintSettingsDto();
        ps.setEnabled(true);
        ps.setFormat(1);
        ps.setQuantity(100);
        request.setPrintSettings(ps);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("greater than print quantity"));
    }

    @Test
    void disabledPrintedDetail_withPartsPerSheetGreaterThanQuantity_allowed() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setIsPrinted(true);
        request.getDetails().get(0).setPartsPerSheetOnPrint(101);
        request.getDetails().get(0).setEnabled(false);

        com.korobki.api.dto.PrintSettingsDto ps = new com.korobki.api.dto.PrintSettingsDto();
        ps.setEnabled(true);
        ps.setFormat(1);
        ps.setQuantity(100);
        request.setPrintSettings(ps);

        assertDoesNotThrow(() -> service.calculate(request));
    }

    // --- «Сборка на печатный лист» ---

    /** Valid request in assembly mode: one detail on the sheet, no print settings. */
    private CalculationRequest assemblyRequest() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setInAssembly(true);
        request.getDetails().get(0).setColsOnSheet(1);

        com.korobki.api.dto.AssemblySettingsDto assembly = new com.korobki.api.dto.AssemblySettingsDto();
        assembly.setEnabled(true);
        assembly.setFormat(1);
        assembly.setQuantity(200);
        request.setAssemblySettings(assembly);
        return request;
    }

    @Test
    void validAssemblyRequest_passesValidation() {
        assertDoesNotThrow(() -> service.calculate(assemblyRequest()));
    }

    @Test
    void assemblyWithEnabledPrintSettings_rejected() {
        CalculationRequest request = assemblyRequest();
        com.korobki.api.dto.PrintSettingsDto ps = new com.korobki.api.dto.PrintSettingsDto();
        ps.setEnabled(true);
        ps.setFormat(1);
        ps.setQuantity(200);
        request.setPrintSettings(ps);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("mutually exclusive"));
    }

    @Test
    void assemblyWithDisabledPrintSettings_allowed() {
        CalculationRequest request = assemblyRequest();
        com.korobki.api.dto.PrintSettingsDto ps = new com.korobki.api.dto.PrintSettingsDto();
        ps.setEnabled(false);
        ps.setFormat(1);
        ps.setQuantity(200);
        request.setPrintSettings(ps);

        assertDoesNotThrow(() -> service.calculate(request));
    }

    @Test
    void assemblyWithoutFormat_rejected() {
        CalculationRequest request = assemblyRequest();
        request.getAssemblySettings().setFormat(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("format is missing"));
    }

    @Test
    void assemblyWithZeroQuantity_rejected() {
        CalculationRequest request = assemblyRequest();
        request.getAssemblySettings().setQuantity(0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("quantity must be > 0"));
    }

    @Test
    void assemblyWithZeroColsOnSheet_rejected() {
        CalculationRequest request = assemblyRequest();
        request.getDetails().get(0).setColsOnSheet(0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("colsOnSheet must be >= 1"));
    }

    @Test
    void assemblyWithNullColsOnSheet_meansOneCopy() {
        CalculationRequest request = assemblyRequest();
        request.getDetails().get(0).setColsOnSheet(null);

        assertDoesNotThrow(() -> service.calculate(request));
    }

    @Test
    void assemblyWithoutDetailsInAssembly_rejected() {
        CalculationRequest request = assemblyRequest();
        request.getDetails().get(0).setInAssembly(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(request));
        assertTrue(ex.getMessage().contains("no enabled detail is marked for assembly"));
    }

    @Test
    void assemblyWithDisabledDetailInAssembly_rejected() {
        CalculationRequest request = assemblyRequest();
        request.getDetails().get(0).setEnabled(false);

        // Отключённая деталь не участвует в расчёте: сборке нечего печатать.
        assertThrows(IllegalArgumentException.class, () -> service.calculate(request));
    }

    @Test
    void disabledAssemblySettings_passesValidation() {
        CalculationRequest request = validRequest();
        request.getDetails().get(0).setInAssembly(true);

        com.korobki.api.dto.AssemblySettingsDto assembly = new com.korobki.api.dto.AssemblySettingsDto();
        assembly.setEnabled(false);
        request.setAssemblySettings(assembly);

        assertDoesNotThrow(() -> service.calculate(request));
    }

    // --- Сборка: связывание расчёта и ответа ---

    /** Reference run: 200 sheets → tariff 300 (7500) → 37.5 ₽/sheet, 37.5 ₽/part. */
    private static PrintCostCalculator.AssemblyRun referenceRun() {
        return new PrintCostCalculator.AssemblyRun(200, 300, new BigDecimal("7500"),
                new BigDecimal("37.5"), new BigDecimal("37.5"), 1);
    }

    @Test
    void assemblyMode_mapsRunToResponseFields() {
        org.mockito.Mockito.when(printCostCalculator.calcAssemblyRun(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(referenceRun());

        CalculationResponse response = service.calculate(assemblyRequest());

        assertEquals(200, response.getAssemblySheets());
        assertEquals(1, response.getAssemblyPartsOnSheet());
        assertEquals(0, new BigDecimal("37.5").compareTo(response.getAssemblySheetCost()));
        assertEquals(0, new BigDecimal("37.5").compareTo(response.getAssemblyCostPerPart()));
        // Режимы взаимоисключающие: печать одной детали в ответе остаётся нулевой.
        assertEquals(0, BigDecimal.ZERO.compareTo(response.getPrintCostPerUnit()));

        // Новый per-detail блок: одна деталь в сборке, 200 листов, 37.5 ₽ за копию.
        assertEquals(1, response.getDetails().size());
        var detailCost = response.getDetails().get(0);
        assertEquals(0, detailCost.getDetailId());
        assertTrue(detailCost.getInAssembly());
        assertEquals(1, detailCost.getColsOnSheet());
        assertEquals(200, detailCost.getSheets());
        assertEquals(0, new BigDecimal("37.5").compareTo(detailCost.getPerPart()));
        assertFalse(detailCost.getPrintBlocked());
    }

    @Test
    void assemblyMode_forwardsFormatQuantityAndDetailsToCalculator() {
        org.mockito.Mockito.when(printCostCalculator.calcAssemblyRun(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(referenceRun());

        service.calculate(assemblyRequest());

        org.mockito.ArgumentCaptor<Integer> format =
                org.mockito.ArgumentCaptor.forClass(Integer.class);
        org.mockito.ArgumentCaptor<Integer> quantity =
                org.mockito.ArgumentCaptor.forClass(Integer.class);
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<java.util.List<PrintCostCalculator.DetailSheet>> sheets =
                org.mockito.ArgumentCaptor.forClass(java.util.List.class);

        org.mockito.Mockito.verify(printCostCalculator)
                .calcAssemblyRun(format.capture(), quantity.capture(), sheets.capture());

        assertEquals(1, format.getValue().intValue());
        assertEquals(200, quantity.getValue().intValue());
        assertEquals(1, sheets.getValue().size());
        assertEquals("Дно", sheets.getValue().get(0).name());
        assertEquals(Integer.valueOf(1), sheets.getValue().get(0).colsOnSheet());
    }

    @Test
    void baseMode_forwardsNullAssemblyRun() {
        service.calculate(validRequest());

        org.mockito.ArgumentCaptor<PrintCostCalculator.AssemblyRun> run =
                org.mockito.ArgumentCaptor.forClass(PrintCostCalculator.AssemblyRun.class);
        org.mockito.Mockito.verify(costCalculator).calculateTotalCost(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                run.capture());
        // Без режима сборки CostCalculator не должен добавлять стоимость печати.
        assertNull(run.getValue());
    }

    @Test
    void assemblyMode_countsOnlyActiveDetailsAndAssembledParts() {
        CalculationRequest request = assemblyRequest();
        // 1 + 2 = 3 детали на листе; 37.5 ₽/лист → 12.5 ₽ за копию.
        PrintCostCalculator.AssemblyRun run = new PrintCostCalculator.AssemblyRun(
                200, 300, new BigDecimal("7500"), new BigDecimal("37.5"),
                new BigDecimal("12.5"), 3);
        org.mockito.Mockito.when(printCostCalculator.calcAssemblyRun(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(run);
        DetailDto first = request.getDetails().get(0); // 1 копия на листе

        DetailDto second = new DetailDto();
        second.setName("Крышка");
        second.setCountOnSheet(new BigDecimal("4"));
        second.setSheetPrice(new BigDecimal("35"));
        second.setEnabled(true);
        second.setInAssembly(true);
        second.setColsOnSheet(2); // 2 копии на листе

        DetailDto disabled = new DetailDto();
        disabled.setName("Разделитель");
        disabled.setCountOnSheet(BigDecimal.ZERO);
        disabled.setSheetPrice(new BigDecimal("35"));
        disabled.setEnabled(false); // выключенная деталь в комплект не входит
        disabled.setInAssembly(true);

        request.setDetails(java.util.List.of(first, second, disabled));

        CalculationResponse response = service.calculate(request);

        assertEquals(3, response.getAssemblyPartsOnSheet());
        // В ответе — строка на каждую деталь запроса; выключенная не участвует.
        assertEquals(3, response.getDetails().size());
        assertFalse(response.getDetails().get(2).getInAssembly());
        assertEquals(0, BigDecimal.ZERO.compareTo(response.getDetails().get(2).getPerPart()));

        // Прогон считается один раз, по всем деталям на листе.
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<java.util.List<PrintCostCalculator.DetailSheet>> sheets =
                org.mockito.ArgumentCaptor.forClass(java.util.List.class);
        org.mockito.Mockito.verify(printCostCalculator, org.mockito.Mockito.times(1))
                .calcAssemblyRun(org.mockito.ArgumentMatchers.eq(1),
                        org.mockito.ArgumentMatchers.eq(200), sheets.capture());
        assertEquals(2, sheets.getValue().size());
        assertEquals(Integer.valueOf(1), sheets.getValue().get(0).colsOnSheet());
        assertEquals(Integer.valueOf(2), sheets.getValue().get(1).colsOnSheet());
    }
}
