package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationChainSummary;
import com.korobki.persistence.repository.CalculationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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

    /** Версия дерева: id, дерево, номер, родитель. */
    private Calculation version(UUID id, UUID rootId, int number, UUID parentId) {
        Calculation calculation = new Calculation();
        calculation.setId(id);
        calculation.setRootId(rootId);
        calculation.setVersion(number);
        calculation.setParentId(parentId);
        calculation.setName("Расчёт " + number);
        calculation.setClientName("Клиент");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("draft");
        return calculation;
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
    void save_opensVersionTreeAndStoresResultSnapshot() {
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
        assertEquals(dto.getId(), dto.getRootId(), "первая версия открывает дерево");

        Calculation saved = captureSaved();
        assertNull(saved.getParentId(), "у корня дерева нет родителя");
        assertNotNull(saved.getCalculationResult(), "снапшот результата обязателен");
        assertTrue(saved.getCalculationResult().containsKey("totalCost"));
    }

    @Test
    void save_calculatorRejectsRequest_doesNotPersist() {
        when(calculatorService.calculate(any()))
                .thenThrow(new IllegalArgumentException("Печать включена, но не выбран формат печати"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.save(validRequest()));

        assertEquals("Печать включена, но не выбран формат печати", ex.getMessage());
        verify(repository, never()).save(any());
    }

    /** Сохранённый вызов save() для проверки записанных в сущность полей. */
    private Calculation captureSaved() {
        var captor = org.mockito.ArgumentCaptor.forClass(Calculation.class);
        verify(repository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void list_returnsOneRowPerTreeWithNewestTip() {
        UUID rootId = UUID.randomUUID();
        UUID tipId = UUID.randomUUID();
        Calculation root = version(rootId, rootId, 1, null);
        Calculation tip = version(tipId, rootId, 2, rootId);

        CalculationChainSummary summary = mock(CalculationChainSummary.class);
        when(summary.getRootId()).thenReturn(rootId);
        when(summary.getVersion()).thenReturn(2);
        when(summary.getVersionCount()).thenReturn(2L);
        when(summary.getLastUpdated()).thenReturn(LocalDateTime.of(2026, 11, 1, 10, 0));

        when(repository.findChainSummary()).thenReturn(List.of(summary));
        when(repository.findAllById(List.of(rootId))).thenReturn(List.of(root));
        when(repository.findByRootIdOrderByVersionAsc(rootId)).thenReturn(List.of(root, tip));

        List<CalculationDto> result = service.list();

        assertEquals(1, result.size());
        assertEquals(rootId, result.get(0).getId(), "строка списка указывает на корень дерева");
        assertEquals(2, result.get(0).getVersion());
        assertEquals(2L, result.get(0).getVersionCount());
        assertEquals(tipId, result.get(0).getLatestId(), "редактировать продолжают самую свежую ветку");
        assertEquals(LocalDateTime.of(2026, 11, 1, 10, 0), result.get(0).getUpdatedAt());
    }

    @Test
    void list_withoutTree_returnsEmptyList() {
        when(repository.findChainSummary()).thenReturn(List.of());

        assertTrue(service.list().isEmpty());
        verify(repository, never()).findAllById(any());
    }

    @Test
    void get_existingId_returnsDto() {
        Calculation calculation = version(UUID.randomUUID(), UUID.randomUUID(), 3, null);
        calculation.setStatus("ready");
        when(repository.findById(calculation.getId())).thenReturn(Optional.of(calculation));

        CalculationDto dto = service.get(calculation.getId());

        assertEquals("ready", dto.getStatus());
    }

    @Test
    void get_missingId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.get(id));
    }

    @Test
    void delete_marksVersionAndItsSubtreeDeleted() {
        UUID rootId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        UUID thirdId = UUID.randomUUID();
        UUID otherBranchId = UUID.randomUUID();

        Calculation root = version(rootId, rootId, 1, null);
        Calculation second = version(secondId, rootId, 2, rootId);
        Calculation third = version(thirdId, rootId, 3, secondId);
        Calculation otherBranch = version(otherBranchId, rootId, 2, rootId);

        when(repository.findById(secondId)).thenReturn(Optional.of(second));
        when(repository.findByRootIdOrderByVersionAsc(rootId))
                .thenReturn(List.of(root, second, otherBranch, third));

        service.delete(secondId);

        assertNotNull(second.getDeletedAt(), "удаляемая версия помечается удалённой");
        assertNotNull(third.getDeletedAt(), "подветка удаляется вместе с родителем");
        assertNull(root.getDeletedAt(), "корень остаётся живым");
        assertNull(otherBranch.getDeletedAt(), "соседняя ветка не затронута");
        verify(repository, never()).deleteById(any());
    }

    @Test
    void delete_missingId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.delete(id));
    }
}
