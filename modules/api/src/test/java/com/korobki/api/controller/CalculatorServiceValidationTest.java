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

class CalculatorServiceValidationTest {

    private CalculatorService service;
    private CostCalculator costCalculator;
    private PriceCalculator priceCalculator;

    @BeforeEach
    void setUp() {
        costCalculator = org.mockito.Mockito.mock(CostCalculator.class);
        priceCalculator = org.mockito.Mockito.mock(PriceCalculator.class);
        PrintCostCalculator printCostCalculator = org.mockito.Mockito.mock(PrintCostCalculator.class);

        // Stub the math so requests that pass validation complete without NPE
        org.mockito.Mockito.when(costCalculator.calculateTotalCost(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
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
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
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
}
