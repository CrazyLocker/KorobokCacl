package com.korobki.api.service;

import com.korobki.api.dto.CalculationOrderDto;
import com.korobki.api.dto.CalculationOrderSaveRequest;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяет заказы, которые вырастают из версии расчёта: клиент и цена берутся
 * у версии-источника, номер генерируется сам, дубликат и перенос на другую
 * версию не проходят.
 */
class CalculationOrderServiceTest {

    private CalculationOrderRepository orderRepository;
    private CustomerRepository customerRepository;
    private CalculationRepository calculationRepository;
    private CalculationOrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(CalculationOrderRepository.class);
        customerRepository = mock(CustomerRepository.class);
        calculationRepository = mock(CalculationRepository.class);
        service = new CalculationOrderService(orderRepository, customerRepository, calculationRepository);
    }

    /** Клиент справочника. */
    private Customer customer(String name) {
        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName(name);
        customer.setActive(true);
        return customer;
    }

    /** Версия расчёта клиента со снапшотом стоимости. */
    private Calculation version(Customer customer, int number, String totalCost) {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setRootId(UUID.randomUUID());
        calculation.setVersion(number);
        calculation.setName("Расчёт v" + number);
        calculation.setClientName(customer == null ? null : customer.getName());
        calculation.setManagerName("Иванов");
        calculation.setCustomerId(customer == null ? null : customer.getId());
        if (totalCost != null) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("totalCost", totalCost);
            calculation.setCalculationResult(snapshot);
        }
        return calculation;
    }

    /** Существующий заказ клиента. */
    private CalculationOrder order(Customer customer, String number, Calculation source) {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setCustomerId(customer.getId());
        order.setNumber(number);
        order.setOrderDate(LocalDate.of(2026, 10, 1));
        order.setStatus("draft");
        order.setSourceCalculationId(source == null ? null : source.getId());
        return order;
    }

    /** Запрос создания заказа из версии. */
    private CalculationOrderSaveRequest request(Calculation source, String number) {
        CalculationOrderSaveRequest request = new CalculationOrderSaveRequest();
        request.setSourceCalculationId(source.getId());
        request.setNumber(number);
        return request;
    }

    @Test
    void create_blankNumber_generatesNextNumberForTheYear() {
        Customer client = customer("Ромашка");
        Calculation source = version(client, 2, "100.00");
        int year = LocalDate.now().getYear();
        when(calculationRepository.findById(source.getId())).thenReturn(Optional.of(source));
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        when(orderRepository.findByCustomerIdOrderByOrderDateDescCreatedAtDesc(client.getId()))
                .thenReturn(List.of(order(client, year + "-001", source),
                        order(client, year + "-002", source)));
        when(orderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CalculationOrderDto created = service.create(request(source, "  "));

        assertEquals(year + "-003", created.getNumber());
        assertEquals("draft", created.getStatus());
        assertEquals(LocalDate.now(), created.getOrderDate());
    }

    @Test
    void create_takesClientAndCostFromSourceVersion() {
        Customer client = customer("Ромашка");
        Calculation source = version(client, 4, "321.50");
        when(calculationRepository.findById(source.getId())).thenReturn(Optional.of(source));
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        when(orderRepository.findByCustomerIdAndNumberIgnoreCase(client.getId(), "2026-777"))
                .thenReturn(Optional.empty());
        when(orderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CalculationOrderDto created = service.create(request(source, "2026-777"));

        assertEquals(client.getId(), created.getCustomerId());
        assertEquals("Ромашка", created.getCustomerName());
        assertEquals(source.getId(), created.getSourceCalculationId());
        assertEquals(4, created.getSourceVersion());
        assertEquals("Расчёт v4", created.getSourceCalculationName());
        assertEquals(0, new BigDecimal("321.50").compareTo(created.getTotalCost()),
                "цена заказа — снапшот версии-источника: " + created.getTotalCost());
    }

    @Test
    void create_duplicateNumber_isRejected() {
        Customer client = customer("Ромашка");
        Calculation source = version(client, 1, "10.00");
        when(calculationRepository.findById(source.getId())).thenReturn(Optional.of(source));
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        when(orderRepository.findByCustomerIdAndNumberIgnoreCase(client.getId(), "2026-001"))
                .thenReturn(Optional.of(order(client, "2026-001", source)));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.create(request(source, "2026-001")));

        assertTrue(error.getMessage().contains("уже есть у клиента"), error.getMessage());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void create_unknownVersion_throwsNotFound() {
        Calculation source = version(customer("Ромашка"), 1, "10.00");
        when(calculationRepository.findById(source.getId())).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.create(request(source, "2026-001")));
    }

    @Test
    void create_versionWithoutClient_isRejected() {
        Calculation source = version(null, 1, "10.00");
        when(calculationRepository.findById(source.getId())).thenReturn(Optional.of(source));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.create(request(source, "2026-001")));

        assertEquals("У расчёта не указан клиент — сначала выберите клиента", error.getMessage());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void create_unknownStatus_isRejected() {
        Customer client = customer("Ромашка");
        Calculation source = version(client, 1, "10.00");
        when(calculationRepository.findById(source.getId())).thenReturn(Optional.of(source));
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        CalculationOrderSaveRequest request = request(source, "2026-001");
        request.setStatus("согласование");

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.create(request));

        assertTrue(error.getMessage().contains("Неизвестный статус заказа"), error.getMessage());
    }

    @Test
    void update_sourceVersionChange_isRejected() {
        Customer client = customer("Ромашка");
        Calculation first = version(client, 1, "10.00");
        Calculation second = version(client, 2, "20.00");
        CalculationOrder stored = order(client, "2026-001", first);
        when(orderRepository.findById(stored.getId())).thenReturn(Optional.of(stored));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.update(stored.getId(), request(second, "2026-001")));

        assertTrue(error.getMessage().contains("нельзя перенести на другую версию"), error.getMessage());
    }

    @Test
    void update_changesStatusAndComment() {
        Customer client = customer("Ромашка");
        Calculation source = version(client, 1, "10.00");
        CalculationOrder stored = order(client, "2026-001", source);
        when(orderRepository.findById(stored.getId())).thenReturn(Optional.of(stored));
        when(customerRepository.findById(client.getId())).thenReturn(Optional.of(client));
        when(calculationRepository.findAllById(any())).thenReturn(List.of(source));

        CalculationOrderSaveRequest request = request(source, "2026-001");
        request.setStatus("sent");
        request.setComment("Отправлено клиенту");

        CalculationOrderDto updated = service.update(stored.getId(), request);

        assertEquals("sent", updated.getStatus());
        assertEquals("Отправлено клиенту", updated.getComment());
        assertEquals(1, updated.getSourceVersion());
    }

    @Test
    void list_reportsSourceVersionOfEachOrder() {
        Customer client = customer("Ромашка");
        Calculation source = version(client, 3, "150.50");
        CalculationOrder stored = order(client, "2026-001", source);
        when(orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()).thenReturn(List.of(stored));
        when(customerRepository.findAll()).thenReturn(List.of(client));
        when(calculationRepository.findAllById(any())).thenReturn(List.of(source));

        CalculationOrderDto dto = service.list(null).get(0);

        assertEquals("Ромашка", dto.getCustomerName());
        assertEquals(3, dto.getSourceVersion(), "видно, из какой версии вырос заказ");
        assertEquals(0, new BigDecimal("150.50").compareTo(dto.getTotalCost()),
                "сумма заказа — стоимость версии-источника: " + dto.getTotalCost());
    }

    @Test
    void delete_marksOrderButKeepsTheRow() {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setNumber("2026-004");
        order.setStatus("draft");
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        service.delete(order.getId());

        assertNotNull(order.getDeletedAt(), "заказ помечен удалённым");
        verify(orderRepository, never()).deleteById(any());
    }

    @Test
    void update_deletedOrder_isRejected() {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setNumber("2026-005");
        order.setStatus("draft");
        order.setDeletedAt(LocalDateTime.now());
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        CalculationOrderSaveRequest request = new CalculationOrderSaveRequest();
        request.setStatus("ready");

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class, () -> service.update(order.getId(), request));

        assertTrue(error.getMessage().contains("помечен удалённым"), error.getMessage());
    }

    @Test
    void purge_rejectsOrdersThatAreNotMarked() {
        CalculationOrder marked = new CalculationOrder();
        marked.setId(UUID.randomUUID());
        marked.setNumber("2026-006");
        marked.setStatus("draft");
        marked.setDeletedAt(LocalDateTime.now());

        CalculationOrder alive = new CalculationOrder();
        alive.setId(UUID.randomUUID());
        alive.setNumber("2026-007");
        alive.setStatus("draft");

        when(orderRepository.findAllById(any())).thenReturn(List.of(marked, alive));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class, () -> service.purge(List.of(marked.getId(), alive.getId())));

        assertTrue(error.getMessage().contains("2026-007"), error.getMessage());
        assertTrue(error.getMessage().contains("только помеченные"), error.getMessage());
        verify(orderRepository, never()).deleteAll(any());
    }

    @Test
    void purge_erasesMarkedOrders() {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setNumber("2026-008");
        order.setStatus("draft");
        order.setDeletedAt(LocalDateTime.now());

        when(orderRepository.findAllById(any())).thenReturn(List.of(order));

        assertEquals(1, service.purge(List.of(order.getId())));
        verify(orderRepository).deleteAll(List.of(order));
    }
}
