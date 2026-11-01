package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Полное удаление ветки расчёта: строки исчезают, история не хранит следов. */
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

    @Test
    void purge_erasesVersionWithItsSubtree() {
        UUID root = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        List<Calculation> chain = List.of(
                version(root, root, 1, null),
                version(second, root, 2, root),
                version(third, root, 3, second));

        when(repository.findById(second)).thenReturn(Optional.of(chain.get(1)));
        when(repository.findByRootIdOrderByVersionAsc(root)).thenReturn(chain);

        service.purge(second);

        verify(repository).deleteById(second);
        verify(orderRepository).findBySourceCalculationIdIn(
                argThat(ids -> ids.size() == 2 && ids.contains(second) && ids.contains(third)));
    }

    @Test
    void purge_keepsBranchThatAnOrderGrewFrom() {
        UUID root = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<Calculation> chain = List.of(
                version(root, root, 1, null),
                version(second, root, 2, root));

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
    void purge_missingVersion_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.purge(id));
        verify(repository, never()).deleteById(any());
    }
}
