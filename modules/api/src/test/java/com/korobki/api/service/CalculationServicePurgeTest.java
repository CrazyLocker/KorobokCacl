package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Полное удаление: строки исчезают, но только у версий, уже помеченных удалёнными. */
class CalculationServicePurgeTest {

    private CalculationRepository repository;
    private CalculationOrderRepository orderRepository;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        CustomerRepository customerRepository = mock(CustomerRepository.class);
        orderRepository = mock(CalculationOrderRepository.class);

        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName("ООО Ромашка");
        when(customerRepository.findById(any())).thenReturn(Optional.of(customer));

        service = new CalculationService(
                repository, customerRepository, orderRepository, new ObjectMapper(),
                mock(CalculatorService.class));
        when(orderRepository.findBySourceCalculationIdIn(any())).thenReturn(List.of());
    }

    /** Версия дерева: id, дерево, номер, родитель. */
    private Calculation version(UUID id, UUID rootId, int number, UUID parentId) {
        Calculation calculation = new Calculation();
        calculation.setId(id);
        calculation.setRootId(rootId);
        calculation.setVersion(number);
        calculation.setParentId(parentId);
        calculation.setName("Расчёт " + number);
        calculation.setClientName("ООО Ромашка");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("draft");
        return calculation;
    }

    /** Помечает версию удалённой, как это делает мягкое удаление. */
    private void markDeleted(Calculation calculation) {
        calculation.setDeletedAt(LocalDateTime.now());
    }

    @Test
    void purge_erasesMarkedVersionWithItsSubtree() {
        UUID root = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        List<Calculation> chain = List.of(
                version(root, root, 1, null),
                version(second, root, 2, root),
                version(third, root, 3, second));
        markDeleted(chain.get(1));
        markDeleted(chain.get(2));

        when(repository.findById(second)).thenReturn(Optional.of(chain.get(1)));
        when(repository.findByRootIdOrderByVersionAsc(root)).thenReturn(chain);

        service.purge(second);

        verify(repository).deleteById(second);
        verify(orderRepository).findBySourceCalculationIdIn(
                argThat(ids -> ids.size() == 2 && ids.contains(second) && ids.contains(third)));
    }

    @Test
    void purge_unmarkedVersion_isRejected() {
        UUID root = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<Calculation> chain = List.of(
                version(root, root, 1, null),
                version(second, root, 2, root));

        when(repository.findById(second)).thenReturn(Optional.of(chain.get(1)));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class, () -> service.purge(second));

        assertTrue(error.getMessage().contains("не помечена"), error.getMessage());
        verify(repository, never()).deleteById(any());
    }

    @Test
    void purge_keepsBranchThatAnOrderGrewFrom() {
        UUID root = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<Calculation> chain = List.of(
                version(root, root, 1, null),
                version(second, root, 2, root));
        markDeleted(chain.get(1));

        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setNumber("2026-001");
        order.setSourceCalculationId(second);

        when(repository.findById(second)).thenReturn(Optional.of(chain.get(1)));
        when(repository.findByRootIdOrderByVersionAsc(root)).thenReturn(chain);
        when(orderRepository.findBySourceCalculationIdIn(any())).thenReturn(List.of(order));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class, () -> service.purge(second));

        assertTrue(error.getMessage().contains("заказ 2026-001"), error.getMessage());
        verify(repository, never()).deleteById(any());
    }

    @Test
    void purgeAll_erasesEachMarkedVersionAndCountsThem() {
        UUID root = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<Calculation> chain = List.of(
                version(root, root, 1, null),
                version(second, root, 2, root));
        markDeleted(chain.get(0));
        markDeleted(chain.get(1));

        when(repository.findById(root)).thenReturn(Optional.of(chain.get(0)));
        when(repository.findById(second)).thenReturn(Optional.of(chain.get(1)));
        when(repository.findByRootIdOrderByVersionAsc(root)).thenReturn(chain);

        int erased = service.purgeAll(List.of(root, second));

        assertEquals(2, erased);
        verify(repository).deleteById(root);
        verify(repository).deleteById(second);
    }

    @Test
    void purgeAll_skipsIdentifiersThatAreAlreadyGone() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertEquals(0, service.purgeAll(List.of(id)));
        verify(repository, never()).deleteById(any());
    }
}
