package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationVersionDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Дерево версий: форма веток, номера, пометка удаления, снапшот стоимости. */
class CalculationServiceVersionsTest {

    private CalculationRepository repository;
    private CalculationService service;
    private UUID rootId;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        service = new CalculationService(repository, mock(CustomerRepository.class),
                mock(CalculationOrderRepository.class), new ObjectMapper(), mock(CalculatorService.class));
        rootId = UUID.randomUUID();
    }

    /** Версия дерева с необязательным снапшотом результата. */
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

    private void stubTree(List<Calculation> tree) {
        tree.forEach(version -> when(repository.findById(version.getId())).thenReturn(Optional.of(version)));
        when(repository.findByRootIdOrderByVersionAsc(rootId)).thenReturn(tree);
    }

    @Test
    void versions_returnsTreeParentsBeforeChildren() {
        Calculation v1 = version(1, "62.50");
        Calculation v2 = version(2, "70.00");
        Calculation v3 = version(3, "75.00");
        v2.setParentId(v1.getId());
        v3.setParentId(v2.getId());
        stubTree(List.of(v1, v2, v3));

        List<CalculationVersionDto> versions = service.versions(v3.getId());

        assertEquals(List.of(1, 2, 3), versions.stream().map(CalculationVersionDto::getVersion).toList());
        assertNull(versions.get(0).getParentId(), "корень дерева без родителя");
        assertEquals(v1.getId(), versions.get(1).getParentId());
    }

    @Test
    void versions_keepsBranchesOfOneVersionSideBySide() {
        Calculation v1 = version(1, "10.00");
        Calculation left = version(2, "20.00");
        Calculation right = version(2, "30.00");
        left.setParentId(v1.getId());
        right.setParentId(v1.getId());
        stubTree(List.of(v1, left, right));

        List<CalculationVersionDto> versions = service.versions(v1.getId());

        assertEquals(3, versions.size(), "обе ветки остаются в дереве");
        assertEquals(v1.getId(), versions.get(1).getParentId());
        assertEquals(v1.getId(), versions.get(2).getParentId());
    }

    @Test
    void versions_marksOnlyBranchTipsAsLatest() {
        Calculation v1 = version(1, "10.00");
        Calculation left = version(2, "20.00");
        Calculation right = version(2, "30.00");
        left.setParentId(v1.getId());
        right.setParentId(v1.getId());
        stubTree(List.of(v1, left, right));

        List<CalculationVersionDto> versions = service.versions(v1.getId());

        assertFalse(versions.get(0).isLatest(), "у корня есть дети — он не конец ветки");
        assertTrue(versions.get(1).isLatest());
        assertTrue(versions.get(2).isLatest());
    }

    @Test
    void versions_reportsDeletionMark() {
        Calculation v1 = version(1, "10.00");
        Calculation v2 = version(2, "20.00");
        v2.setParentId(v1.getId());
        v2.setDeletedAt(LocalDateTime.of(2026, 11, 1, 9, 0));
        stubTree(List.of(v1, v2));

        List<CalculationVersionDto> versions = service.versions(v1.getId());

        assertFalse(versions.get(0).isDeleted());
        assertTrue(versions.get(1).isDeleted(), "удалённая версия остаётся в дереве зачёркнутой");
    }

    @Test
    void versions_readsTotalCostFromSnapshot() {
        Calculation v1 = version(1, "62.5000000000");
        stubTree(List.of(v1));

        CalculationVersionDto dto = service.versions(v1.getId()).get(0);

        assertEquals(0, dto.getTotalCost().compareTo(new BigDecimal("62.50")));
    }

    @Test
    void versions_reportsClientPriceAndRunOfThePricedMode() {
        Calculation v1 = version(1, "62.50");
        v1.setCalculationResult(Map.of(
                "totalCost", new BigDecimal("62.50"),
                "basePriceWithVAT", new BigDecimal("123.75")));
        v1.setCalculationState(Map.of(
                "printSettings", Map.of("enabled", false, "quantity", 300),
                "assemblySettings", Map.of("enabled", true, "quantity", 500)));
        stubTree(List.of(v1));

        CalculationVersionDto dto = service.versions(v1.getId()).get(0);

        assertEquals(0, dto.getClientPrice().compareTo(new BigDecimal("123.75")),
                "цена для клиента берётся из снапшота с НДС");
        assertEquals(500, dto.getQuantity(), "при выключенной печати тираж берётся из сборки");
    }

    @Test
    void versions_versionWithoutSnapshot_hasNullTotalCost() {
        Calculation v1 = version(1, null);
        stubTree(List.of(v1));

        CalculationVersionDto dto = service.versions(v1.getId()).get(0);

        assertNull(dto.getTotalCost(), "у записей до появления снапшотов цены нет");
    }

    @Test
    void versions_anyVersionIdResolvesSameTree() {
        Calculation v1 = version(1, "10.00");
        Calculation v2 = version(2, "20.00");
        v2.setParentId(v1.getId());
        stubTree(List.of(v1, v2));

        service.versions(v2.getId());

        verify(repository).findByRootIdOrderByVersionAsc(rootId);
    }

    @Test
    void versions_missingId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class, () -> service.versions(id));

        assertTrue(ex.getMessage().contains("Расчёт не найден"));
        verify(repository, never()).findByRootIdOrderByVersionAsc(any());
    }
}
