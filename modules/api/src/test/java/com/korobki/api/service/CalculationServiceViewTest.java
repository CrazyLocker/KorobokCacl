package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
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
}
