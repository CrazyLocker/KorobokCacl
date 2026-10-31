package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяет сохранение итерации: правка создаёт следующую версию цепочки,
 * метаданные наследуются от родителя, родительская строка не меняется,
 * а расчёт, который не считается, не сохраняется.
 */
class CalculationServiceIterateTest {

    private CalculationRepository repository;
    private CalculatorService calculatorService;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        calculatorService = mock(CalculatorService.class);
        service = new CalculationService(repository, new ObjectMapper(), calculatorService);
    }

    private Calculation parent(int version) {
        Calculation parent = new Calculation();
        parent.setId(UUID.randomUUID());
        parent.setRootId(UUID.randomUUID());
        parent.setVersion(version);
        parent.setName("Коробка для часов");
        parent.setClientName("ООО Ромашка");
        parent.setManagerName("Иванов");
        parent.setStatus("ready");
        when(repository.findById(parent.getId())).thenReturn(Optional.of(parent));
        return parent;
    }

    private CalculationRequest editedRequest() {
        CalculationRequest request = new CalculationRequest();
        request.setConstruction("Этне 2 (шубер)");
        request.setWorkPrice(new BigDecimal("6"));
        return request;
    }

    private void stubCalculatorAndSave() {
        CalculationResponse response = new CalculationResponse();
        response.setTotalCost(new BigDecimal("200"));
        when(calculatorService.calculate(any())).thenReturn(response);
        when(repository.save(any())).thenAnswer(inv -> {
            Calculation c = inv.getArgument(0);
            if (c.getId() == null) {
                c.setId(UUID.randomUUID());
            }
            return c;
        });
    }

    @Test
    void iterate_createsNextVersionOfSameChain() {
        stubCalculatorAndSave();
        Calculation parent = parent(1);
        when(repository.findTopByRootIdOrderByVersionDesc(parent.getRootId()))
                .thenReturn(Optional.of(parent));

        CalculationDto dto = service.iterate(parent.getId(), editedRequest());

        assertEquals(2, dto.getVersion());
        assertEquals(parent.getRootId(), dto.getRootId());
    }

    @Test
    void iterate_inheritsMetadataFromParent() {
        stubCalculatorAndSave();
        Calculation parent = parent(1);
        when(repository.findTopByRootIdOrderByVersionDesc(parent.getRootId()))
                .thenReturn(Optional.of(parent));

        CalculationDto dto = service.iterate(parent.getId(), editedRequest());

        assertEquals("Коробка для часов", dto.getName());
        assertEquals("ООО Ромашка", dto.getClientName());
        assertEquals("Иванов", dto.getManagerName());
        assertEquals("ready", dto.getStatus());
    }

    @Test
    void iterate_usesHeadVersionWhenEditingAnOldVersion() {
        stubCalculatorAndSave();
        Calculation first = parent(1);
        Calculation head = new Calculation();
        head.setId(UUID.randomUUID());
        head.setRootId(first.getRootId());
        head.setVersion(4);
        when(repository.findTopByRootIdOrderByVersionDesc(first.getRootId()))
                .thenReturn(Optional.of(head));

        CalculationDto dto = service.iterate(first.getId(), editedRequest());

        assertEquals(5, dto.getVersion(), "номер берётся по голове цепочки, а не по родителю");
    }

    @Test
    void iterate_storesRequestAndResultSnapshot() {
        stubCalculatorAndSave();
        Calculation parent = parent(1);
        when(repository.findTopByRootIdOrderByVersionDesc(parent.getRootId()))
                .thenReturn(Optional.of(parent));

        service.iterate(parent.getId(), editedRequest());

        ArgumentCaptor<Calculation> captor = ArgumentCaptor.forClass(Calculation.class);
        verify(repository).save(captor.capture());
        Calculation saved = captor.getValue();

        assertNotNull(saved.getCalculationState());
        assertEquals("Этне 2 (шубер)", saved.getCalculationState().get("construction"));
        assertNotNull(saved.getCalculationResult());
        assertNotNull(saved.getCalculationResult().get("totalCost"));
    }

    @Test
    void iterate_calculatorRejectsRequest_doesNotPersist() {
        when(calculatorService.calculate(any()))
                .thenThrow(new IllegalArgumentException("нет валидных деталей"));
        Calculation parent = parent(1);

        assertThrows(IllegalArgumentException.class,
                () -> service.iterate(parent.getId(), editedRequest()));

        verify(repository, never()).save(any());
    }

    @Test
    void iterate_missingCalculation_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.iterate(id, editedRequest()));
        verify(calculatorService, never()).calculate(any());
    }
}
