package com.korobki.api.controller;

import com.korobki.api.dto.CalculationRequest;
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

    @BeforeEach
    void setUp() {
        CostCalculator costCalculator = org.mockito.Mockito.mock(CostCalculator.class);
        PriceCalculator priceCalculator = org.mockito.Mockito.mock(PriceCalculator.class);
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
}
