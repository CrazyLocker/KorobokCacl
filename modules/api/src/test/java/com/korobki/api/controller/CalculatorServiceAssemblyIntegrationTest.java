package com.korobki.api.controller;

import com.korobki.api.dto.AssemblySettingsDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.DetailDto;
import com.korobki.calculator.service.CostCalculator;
import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.core.config.PricingConfig;
import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.PrintTableRepository;
import com.korobki.pricing.PriceCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * End-to-end wiring of the «Сборка на печатный лист» model: the real
 * {@link CostCalculator} and {@link PrintCostCalculator} are used, only the
 * price list and the print-table repository are mocked.
 *
 * <p>Print table: 100 sheets → 5500, 300 → 7500, 500 → 9000, +1500 per
 * started 1000 sheets after 3000.
 */
@SuppressWarnings("deprecation") // legacy assembly response fields
class CalculatorServiceAssemblyIntegrationTest {

    private CalculatorService service;

    @BeforeEach
    void setUp() {
        PrintTableRepository repository = mock(PrintTableRepository.class);
        PrintTable table = new PrintTable();
        table.setFormatId(1);
        table.setFormatName("70×100");
        table.setSteps(List.of(
                Map.of("minQty", 100, "price", 5500),
                Map.of("minQty", 300, "price", 7500),
                Map.of("minQty", 500, "price", 9000)));
        table.setStepAfter3000(new BigDecimal("1500"));
        when(repository.findByFormatId(1)).thenReturn(Optional.of(table));

        PricingConfig config = new PricingConfig();
        config.setManufacturingCost(BigDecimal.ZERO);

        PrintCostCalculator printCostCalculator = new PrintCostCalculator(repository);
        CostCalculator costCalculator = new CostCalculator(printCostCalculator, config);

        PriceCalculator priceCalculator = mock(PriceCalculator.class);
        when(priceCalculator.generatePrices(any(), any(), any())).thenReturn(List.of());
        when(priceCalculator.calcBasePrice(any(), any())).thenReturn(BigDecimal.ZERO);
        when(priceCalculator.getBranch(any(), any())).thenReturn("+30");
        when(priceCalculator.getVatMultiplier()).thenReturn(new BigDecimal("1.11"));

        service = new CalculatorService(costCalculator, priceCalculator, printCostCalculator);
    }

    /** Detail with no material and no work: only the print part is measured. */
    private static DetailDto detail(String name, int colsOnSheet, boolean inAssembly) {
        DetailDto detail = new DetailDto();
        detail.setName(name);
        detail.setCountOnSheet(BigDecimal.ONE);
        detail.setSheetPrice(BigDecimal.ZERO);
        detail.setEnabled(true);
        detail.setInAssembly(inAssembly);
        detail.setColsOnSheet(colsOnSheet);
        return detail;
    }

    private static CalculationRequest assemblyRequest(int quantity, DetailDto... details) {
        CalculationRequest request = new CalculationRequest();
        request.setConstruction("Тест");
        request.setWorkPrice(BigDecimal.ZERO);
        request.setDetails(List.of(details));
        request.setExtras(List.of());

        AssemblySettingsDto assembly = new AssemblySettingsDto();
        assembly.setEnabled(true);
        assembly.setFormat(1);
        assembly.setQuantity(quantity);
        request.setAssemblySettings(assembly);
        return request;
    }

    @Test
    void twoDetailsOnSheet_shareThePrintBill() {
        // 200 комплектов: Дно×3 → 67 листов, Крышка×1 → 200 листов.
        // Прогон 200 листов → тариф 300 (7500); на листе 4 детали
        // → 7500 / 200 / 4 = 9.375 ₽ за деталь, 18.75 ₽ на комплект.
        CalculationResponse response = service.calculate(assemblyRequest(200,
                detail("Дно", 3, true), detail("Крышка", 1, true)));

        assertEquals(200, response.getAssemblySheets());
        assertEquals(4, response.getAssemblyPartsOnSheet());
        assertEquals(0, new BigDecimal("37.5").compareTo(response.getAssemblySheetCost()));
        assertEquals(0, new BigDecimal("9.375").compareTo(response.getAssemblyCostPerPart()));
        assertEquals(0, new BigDecimal("18.75").compareTo(response.getTotalCost()));

        assertEquals(2, response.getDetails().size());
        assertEquals(0, new BigDecimal("9.375")
                .compareTo(response.getDetails().get(0).getPerPart()));
        assertEquals(0, new BigDecimal("9.375")
                .compareTo(response.getDetails().get(1).getPerPart()));
        assertEquals(200, response.getDetails().get(0).getSheets());
    }

    @Test
    void identicalDetailsOneCopyEach_divideByThreeCopies() {
        // 100 комплектов, 3 детали ×1 → 100 листов → тариф 100 (5500);
        // 55 / 3 ≈ 18.333… ₽ за деталь, 55 ₽ на комплект.
        CalculationResponse response = service.calculate(assemblyRequest(100,
                detail("Дно", 1, true),
                detail("Разделитель", 1, true),
                detail("Крышка", 1, true)));

        assertEquals(100, response.getAssemblySheets());
        assertEquals(3, response.getAssemblyPartsOnSheet());
        assertEquals(0, new BigDecimal("18.3333333333")
                .compareTo(response.getDetails().get(0).getPerPart()));
        // Три детали × 18.3333333333 = 54.9999999999 (полная точность).
        assertEquals(0, new BigDecimal("54.9999999999")
                .compareTo(response.getTotalCost()));
    }

    @Test
    void detailOutsideAssembly_getsNoPrintCost() {
        // Одна деталь в сборке: 100 листов → 5500 → 55 ₽ за деталь.
        CalculationResponse response = service.calculate(assemblyRequest(100,
                detail("Дно", 1, true), detail("Крышка", 1, false)));

        assertEquals(0, new BigDecimal("55").compareTo(response.getTotalCost()));
        assertFalse(response.getDetails().get(1).getInAssembly());
        assertEquals(0, BigDecimal.ZERO.compareTo(response.getDetails().get(1).getPerPart()));
        assertEquals(0, response.getDetails().get(1).getSheets().intValue());
    }

    @Test
    void zeroColsOnSheet_isRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.calculate(assemblyRequest(100, detail("Дно", 0, true))));

        assertTrue(ex.getMessage().contains("colsOnSheet must be >= 1"));
    }
}
