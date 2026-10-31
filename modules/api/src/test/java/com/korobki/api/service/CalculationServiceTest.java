package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CalculationServiceTest {

    private CalculationRepository repository;
    private CalculatorService calculatorService;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        calculatorService = mock(CalculatorService.class);
        service = new CalculationService(repository, new ObjectMapper(), calculatorService);
    }

    private CalculationSaveRequest validRequest() {
        CalculationSaveRequest request = new CalculationSaveRequest();
        request.setName("Расчёт 1");
        request.setClientName("ООО Ромашка");
        request.setManagerName("Иванов");

        com.korobki.api.dto.CalculationRequest calc = new com.korobki.api.dto.CalculationRequest();
        calc.setConstruction("Этне 2 (шубер)");
        calc.setWorkPrice(new BigDecimal("5"));
        request.setCalculation(calc);
        return request;
    }

    /** Калькулятор, который всегда возвращает себестоимость 123.45 ₽. */
    private void stubCalculator() {
        CalculationResponse response = new CalculationResponse();
        response.setTotalCost(new BigDecimal("123.45"));
        response.setBasePrice(new BigDecimal("370.35"));
        when(calculatorService.calculate(any())).thenReturn(response);
    }

    @Test
    void save_persistsAllFields() {
        stubCalculator();
        when(repository.save(any())).thenAnswer(inv -> {
            Calculation c = inv.getArgument(0);
            if (c.getId() == null) {
                c.setId(UUID.randomUUID());
            }
            return c;
        });

        CalculationDto dto = service.save(validRequest());

        assertEquals("Расчёт 1", dto.getName());
        assertEquals("ООО Ромашка", dto.getClientName());
        assertEquals("Иванов", dto.getManagerName());
        assertEquals("draft", dto.getStatus());
        assertEquals("Этне 2 (шубер)", dto.getCalculation().get("construction"));
    }

    @Test
    void save_opensVersionChainAndStoresResultSnapshot() {
        stubCalculator();
        when(repository.save(any())).thenAnswer(inv -> {
            Calculation c = inv.getArgument(0);
            if (c.getId() == null) {
                c.setId(UUID.randomUUID());
            }
            return c;
        });

        CalculationDto dto = service.save(validRequest());

        assertEquals(1, dto.getVersion());
        assertEquals(dto.getId(), dto.getRootId(), "первая версия открывает цепочку");

        Calculation saved = captureSaved();
        assertNotNull(saved.getCalculationResult(), "снапшот результата обязателен");
        assertTrue(saved.getCalculationResult().containsKey("totalCost"));
    }

    @Test
    void save_calculatorRejectsRequest_doesNotPersist() {
        when(calculatorService.calculate(any()))
                .thenThrow(new IllegalArgumentException("Print settings enabled but format is missing"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.save(validRequest()));

        assertEquals("Print settings enabled but format is missing", ex.getMessage());
        verify(repository, never()).save(any());
    }

    /** Сохранённый вызов save() для проверки записанных в сущность полей. */
    private Calculation captureSaved() {
        var captor = org.mockito.ArgumentCaptor.forClass(Calculation.class);
        verify(repository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void list_returnsLatestVersionOfEveryChain() {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setRootId(calculation.getId());
        calculation.setVersion(2);
        calculation.setName("Расчёт 2");
        calculation.setClientName("Клиент");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("draft");
        when(repository.findAllHeads()).thenReturn(List.of(calculation));

        List<CalculationDto> result = service.list();

        assertEquals(1, result.size());
        assertEquals("Расчёт 2", result.get(0).getName());
        assertEquals(2, result.get(0).getVersion());
    }

    @Test
    void get_existingId_returnsDto() {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setName("Расчёт 3");
        calculation.setClientName("Клиент");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("ready");
        when(repository.findById(calculation.getId())).thenReturn(Optional.of(calculation));

        CalculationDto dto = service.get(calculation.getId());

        assertEquals("ready", dto.getStatus());
    }

    @Test
    void get_missingId_throws() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.get(id));
    }

    @Test
    void delete_removesWholeChainThroughRoot() {
        UUID rootId = UUID.randomUUID();
        Calculation version = new Calculation();
        version.setId(UUID.randomUUID());
        version.setRootId(rootId);
        version.setVersion(3);
        when(repository.findById(version.getId())).thenReturn(Optional.of(version));

        service.delete(version.getId());

        verify(repository).deleteById(rootId);
    }

    @Test
    void delete_missingId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.delete(id));
        verify(repository, never()).deleteById(any());
    }
}
