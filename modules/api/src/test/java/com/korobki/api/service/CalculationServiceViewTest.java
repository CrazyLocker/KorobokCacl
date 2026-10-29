package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.calculator.service.CostCalculator;
import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.core.config.PricingConfig;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.PrintTableRepository;
import com.korobki.pricing.PriceCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяет «Вид расчёта»: сохранённый state разбирается в запрос и
 * пересчитывается, а битые или неполные данные не роняют запрос, а
 * возвращаются с {@code viewError}.
 */
class CalculationServiceViewTest {

    private CalculationRepository repository;
    private CalculatorService calculatorService;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        calculatorService = mock(CalculatorService.class);
        service = new CalculationService(repository, new ObjectMapper(), calculatorService);
    }

    /** One enabled detail with a material price; no print settings at all. */
    private Map<String, Object> validState() {
        Map<String, Object> detail = new HashMap<>();
        detail.put("name", "Дно");
        detail.put("countOnSheet", 4);
        detail.put("sheetPrice", 35);
        detail.put("enabled", true);

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("construction", "Этне 2 (шубер)");
        state.put("details", List.of(detail));
        state.put("workPrice", 5);
        return state;
    }

    private Calculation storedCalculation(Map<String, Object> state) {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setName("Расчёт 1");
        calculation.setClientName("ООО Ромашка");
        calculation.setManagerName("Иванов");
        calculation.setStatus("draft");
        calculation.setCalculationState(state);
        calculation.setCreatedAt(LocalDateTime.now());
        calculation.setUpdatedAt(LocalDateTime.now());
        when(repository.findById(calculation.getId())).thenReturn(Optional.of(calculation));
        return calculation;
    }

    /**
     * Real calculation pipeline for tests that need actual numbers: the
     * material/print calculators are real, only the price list and the print
     * table repository are mocked.
     */
    private CalculatorService realCalculatorService() {
        PrintTableRepository printTables = mock(PrintTableRepository.class);
        PrintTable table = new PrintTable();
        table.setFormatId(1);
        table.setFormatName("70×100");
        table.setSteps(List.of(
                Map.of("minQty", 100, "price", 5500),
                Map.of("minQty", 300, "price", 7500)));
        table.setStepAfter3000(new BigDecimal("1500"));
        when(printTables.findByFormatId(1)).thenReturn(Optional.of(table));

        PricingConfig config = new PricingConfig();
        config.setManufacturingCost(BigDecimal.ZERO);

        PrintCostCalculator printCostCalculator = new PrintCostCalculator(printTables);
        CostCalculator costCalculator = new CostCalculator(printCostCalculator, config);

        PriceCalculator priceCalculator = mock(PriceCalculator.class);
        when(priceCalculator.generatePrices(any(), any(), any())).thenReturn(List.of());
        when(priceCalculator.calcBasePrice(any(), any())).thenReturn(BigDecimal.ZERO);
        when(priceCalculator.getBranch(any(), any())).thenReturn("+30");
        when(priceCalculator.getVatMultiplier()).thenReturn(new BigDecimal("1.11"));

        return new CalculatorService(costCalculator, priceCalculator, printCostCalculator);
    }

    @Test
    void view_validState_returnsRequestAndResult() {
        Calculation calculation = storedCalculation(validState());
        CalculationResponse response = new CalculationResponse();
        response.setTotalCost(new BigDecimal("123.45"));
        when(calculatorService.calculate(any())).thenReturn(response);

        CalculationViewDto view = service.view(calculation.getId());

        assertEquals(calculation.getId(), view.getId());
        assertEquals("Расчёт 1", view.getName());
        assertEquals("ООО Ромашка", view.getClientName());
        assertEquals("Иванов", view.getManagerName());
        assertEquals("draft", view.getStatus());
        assertNotNull(view.getCreatedAt());
        assertNotNull(view.getUpdatedAt());

        assertNull(view.getViewError());
        assertNotNull(view.getRequest());
        assertEquals("Этне 2 (шубер)", view.getRequest().getConstruction());
        assertEquals(0, new BigDecimal("5").compareTo(view.getRequest().getWorkPrice()));
        assertEquals(1, view.getRequest().getDetails().size());
        assertEquals(0, new BigDecimal("35")
                .compareTo(view.getRequest().getDetails().get(0).getSheetPrice()));
        assertEquals(response, view.getResult());
        assertEquals(0, new BigDecimal("123.45").compareTo(view.getResult().getTotalCost()));
    }

    @Test
    void view_brokenState_returnsViewErrorWithoutResult() {
        Map<String, Object> state = validState();
        state.put("details", "broken"); // не список деталей — разбор падает
        Calculation calculation = storedCalculation(state);

        CalculationViewDto view = service.view(calculation.getId());

        assertNull(view.getRequest());
        assertNull(view.getResult());
        assertNotNull(view.getViewError());
        assertTrue(view.getViewError().startsWith("Не удалось разобрать сохранённый расчёт"),
                view.getViewError());
        verify(calculatorService, never()).calculate(any());
    }

    @Test
    void view_incompleteState_returnsViewErrorWithoutCalculation() {
        Map<String, Object> state = validState();
        state.remove("details");
        Calculation calculation = storedCalculation(state);

        CalculationViewDto view = service.view(calculation.getId());

        assertNotNull(view.getRequest());
        assertNull(view.getResult());
        assertEquals("Не удалось пересчитать: нет деталей", view.getViewError());
        verify(calculatorService, never()).calculate(any());
    }

    @Test
    void view_calculatorRejectsState_returnsViewError() {
        Calculation calculation = storedCalculation(validState());
        when(calculatorService.calculate(any()))
                .thenThrow(new IllegalArgumentException("Print settings enabled but format is missing"));

        CalculationViewDto view = service.view(calculation.getId());

        assertNotNull(view.getRequest());
        assertNull(view.getResult());
        assertEquals("Не удалось пересчитать: Print settings enabled but format is missing",
                view.getViewError());
    }

    @Test
    void view_missingId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.view(id));
    }

    @Test
    void view_printAndAssemblyBothEnabled_disablesPrintAndReturnsResult() {
        // Наследие старых сохранений: оба режима включены одновременно.
        Map<String, Object> detail = new HashMap<>();
        detail.put("name", "Дно");
        detail.put("countOnSheet", 4);
        detail.put("sheetPrice", 35);
        detail.put("enabled", true);
        detail.put("inAssembly", true);
        detail.put("colsOnSheet", 1);

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("construction", "Этне 2 (шубер)");
        state.put("details", List.of(detail));
        state.put("workPrice", 5);
        state.put("printSettings", Map.of("enabled", true, "format", 1, "quantity", 100));
        state.put("assemblySettings", Map.of("enabled", true, "format", 1, "quantity", 50));
        Calculation calculation = storedCalculation(state);

        CalculationService realService =
                new CalculationService(repository, new ObjectMapper(), realCalculatorService());

        CalculationViewDto view = realService.view(calculation.getId());

        assertNull(view.getViewError());
        assertNotNull(view.getResult());
        assertTrue(view.getResult().getTotalCost().compareTo(BigDecimal.ZERO) > 0,
                "себестоимость должна быть посчитана: " + view.getResult().getTotalCost());

        // Сборка остаётся включённой, обычная печать гасится — иначе пересчёт
        // падает на «mutually exclusive».
        assertNotNull(view.getRequest().getAssemblySettings());
        assertTrue(view.getRequest().getAssemblySettings().getEnabled());
        assertEquals(50, view.getRequest().getAssemblySettings().getQuantity().intValue());
        assertFalse(view.getRequest().getPrintSettings().getEnabled());
    }
}
