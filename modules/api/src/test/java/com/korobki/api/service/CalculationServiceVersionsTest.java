package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationVersionDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** История версий: цепочка целиком, номера, снапшот стоимости. */
class CalculationServiceVersionsTest {

    private CalculationRepository repository;
    private CalculationService service;
    private UUID rootId;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        service = new CalculationService(repository, new ObjectMapper(), mock(CalculatorService.class));
        rootId = UUID.randomUUID();
    }

    /** Версия цепочки с необязательным снапшотом результата. */
    private Calculation version(int number, String totalCost) {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setRootId(rootId);
        calculation.setVersion(number);
        calculation.setName("Расчёт " + number);
        calculation.setClientName("Клиент");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("draft");
        if (totalCost != null) {
            calculation.setCalculationResult(Map.of("totalCost", new BigDecimal(totalCost)));
        }
        return calculation;
    }

    private void stubChain(Calculation v3, Calculation v2, Calculation v1) {
        when(repository.findById(v1.getId())).thenReturn(Optional.of(v1));
        when(repository.findById(v2.getId())).thenReturn(Optional.of(v2));
        when(repository.findById(v3.getId())).thenReturn(Optional.of(v3));
        when(repository.findByRootIdOrderByVersionDesc(rootId)).thenReturn(List.of(v3, v2, v1));
    }

    @Test
    void versions_returnsWholeChainNewestFirst() {
        Calculation v1 = version(1, "62.50");
        Calculation v2 = version(2, "70.00");
        Calculation v3 = version(3, "75.00");
        stubChain(v3, v2, v1);

        List<CalculationVersionDto> versions = service.versions(v1.getId());

        assertEquals(List.of(3, 2, 1), versions.stream().map(CalculationVersionDto::getVersion).toList());
        assertEquals(v3.getId(), versions.get(0).getId());
    }

    @Test
    void versions_marksOnlyLatestAsLatest() {
        Calculation v1 = version(1, "10.00");
        Calculation v2 = version(2, "20.00");
        Calculation v3 = version(3, "30.00");
        stubChain(v3, v2, v1);

        List<CalculationVersionDto> versions = service.versions(v2.getId());

        assertTrue(versions.get(0).isLatest(), "голова цепочки — самая новая версия");
        assertFalse(versions.get(1).isLatest());
        assertFalse(versions.get(2).isLatest());
    }

    @Test
    void versions_readsTotalCostFromSnapshot() {
        Calculation v1 = version(1, "62.5000000000");
        stubChain(v1, v1, v1);

        CalculationVersionDto dto = service.versions(v1.getId()).get(0);

        assertEquals(0, dto.getTotalCost().compareTo(new BigDecimal("62.50")));
    }

    @Test
    void versions_versionWithoutSnapshot_hasNullTotalCost() {
        Calculation v1 = version(1, null);
        stubChain(v1, v1, v1);

        CalculationVersionDto dto = service.versions(v1.getId()).get(0);

        assertNull(dto.getTotalCost(), "у записей до появления снапшотов цены нет");
    }

    @Test
    void versions_anyVersionIdResolvesSameChain() {
        Calculation v1 = version(1, "10.00");
        Calculation v2 = version(2, "20.00");
        stubChain(v2, v2, v1);

        service.versions(v2.getId());

        verify(repository).findByRootIdOrderByVersionDesc(rootId);
    }

    @Test
    void versions_missingId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class, () -> service.versions(id));

        assertTrue(ex.getMessage().contains("Расчёт не найден"));
        verify(repository, never()).findByRootIdOrderByVersionDesc(any());
    }
}
