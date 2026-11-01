package com.korobki.api.service;

import com.korobki.api.dto.CalculationOrderDto;
import com.korobki.api.dto.CalculationOrderSaveRequest;
import com.korobki.api.dto.CalculationTreeDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяет заказы клиента: номер генерируется сам, дубликат не проходит,
 * заказ нельзя передать другому клиенту, а сумма заказа складывается из
 * последних версий его расчётов.
 */
class CalculationOrderServiceTest {

    private CalculationOrderRepository orderRepository;
    private CustomerRepository customerRepository;
    private CalculationService calculationService;
    private CalculationOrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(CalculationOrderRepository.class);
        customerRepository = mock(CustomerRepository.class);
        calculationService = mock(CalculationService.class);
        when(calculationService.treesByRoot()).thenReturn(Map.of());
        service = new CalculationOrderService(orderRepository, customerRepository, calculationService);
    }

    /** Клиент справочника. */
    private Customer customer(String name) {
        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName(name);
        customer.setActive(true);
        return customer;
    }

    /** Существующий заказ клиента. */
    private CalculationOrder order(Customer customer, String number) {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setCustomerId(customer.getId());
        order.setNumber(number);
        order.setOrderDate(LocalDate.of(2026, 10, 1));
        order.setStatus("draft");
        return order;
    }

    /** Запрос создания заказа. */
    private CalculationOrderSaveRequest request(Customer customer, String number) {
        CalculationOrderSaveRequest request = new CalculationOrderSaveRequest();
        request.setCustomerId(customer.getId());
        request.setNumber(number);
        return request;
    }

    @Test
    void create_blankNumber_generatesNextNumberForTheYear() {
        Customer client = customer("Ромашка");
        int year = LocalDate.now().getYear();
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        when(orderRepository.findByCustomerIdOrderByOrderDateDescCreatedAtDesc(client.getId()))
                .thenReturn(List.of(order(client, year + "-001"), order(client, year + "-002")));
        when(orderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CalculationOrderDto created = service.create(request(client, "  "));

        assertEquals(year + "-003", created.getNumber());
        assertEquals("draft", created.getStatus());
        assertEquals(LocalDate.now(), created.getOrderDate());
    }

    @Test
    void create_duplicateNumber_isRejected() {
        Customer client = customer("Ромашка");
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        when(orderRepository.findByCustomerIdAndNumberIgnoreCase(client.getId(), "2026-001"))
                .thenReturn(Optional.of(order(client, "2026-001")));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.create(request(client, "2026-001")));

        assertTrue(error.getMessage().contains("уже есть у клиента"), error.getMessage());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void create_unknownClient_throwsNotFound() {
        Customer client = customer("Ромашка");
        when(customerRepository.findById(client.getId())).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.create(request(client, "2026-001")));
    }

    @Test
    void create_unknownStatus_isRejected() {
        Customer client = customer("Ромашка");
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        CalculationOrderSaveRequest request = request(client, "2026-001");
        request.setStatus("согласование");

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.create(request));

        assertTrue(error.getMessage().contains("Неизвестный статус заказа"), error.getMessage());
    }

    @Test
    void update_clientChange_isRejected() {
        Customer client = customer("Ромашка");
        Customer another = customer("Лютик");
        CalculationOrder stored = order(client, "2026-001");
        when(orderRepository.findById(stored.getId())).thenReturn(Optional.of(stored));

        assertThrows(IllegalArgumentException.class,
                () -> service.update(stored.getId(), request(another, "2026-001")));
    }

    @Test
    void update_changesStatusAndComment() {
        Customer client = customer("Ромашка");
        CalculationOrder stored = order(client, "2026-001");
        when(orderRepository.findById(stored.getId())).thenReturn(Optional.of(stored));
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));

        CalculationOrderSaveRequest request = request(client, "2026-001");
        request.setStatus("sent");
        request.setComment("Отправлено клиенту");

        CalculationOrderDto updated = service.update(stored.getId(), request);

        assertEquals("sent", updated.getStatus());
        assertEquals("Отправлено клиенту", updated.getComment());
    }

    @Test
    void list_sumsCostsOfLatestVersions() {
        Customer client = customer("Ромашка");
        CalculationOrder stored = order(client, "2026-001");
        when(orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()).thenReturn(List.of(stored));
        when(customerRepository.findAll()).thenReturn(List.of(client));

        CalculationTreeDto first = new CalculationTreeDto();
        first.setId(UUID.randomUUID());
        first.setOrderId(stored.getId());
        first.setTotalCost(new BigDecimal("100.00"));
        first.setUpdatedAt(LocalDateTime.now());

        CalculationTreeDto second = new CalculationTreeDto();
        second.setId(UUID.randomUUID());
        second.setOrderId(stored.getId());
        second.setTotalCost(new BigDecimal("50.50"));
        second.setUpdatedAt(LocalDateTime.now().minusDays(1));

        when(calculationService.treesByRoot()).thenReturn(Map.of(first.getId(), first, second.getId(), second));

        CalculationOrderDto dto = service.list(null).get(0);

        assertEquals("Ромашка", dto.getCustomerName());
        assertEquals(2L, dto.getCalculationCount());
        assertEquals(0, new BigDecimal("150.50").compareTo(dto.getTotalCost()),
                "сумма заказа должна складываться из расчётов: " + dto.getTotalCost());
    }
}
