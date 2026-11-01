package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CustomerTreeDto;
import com.korobki.api.dto.OrderTreeDto;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Проверяет дерево «Клиент → Заказ → Расчёт»: расчёты без заказа остаются у
 * клиента, заказ без расчётов не пропадает, старые строки без клиента попадают
 * в отдельную корзину, а суммы считаются по последней версии каждого расчёта.
 */
class CalculationServiceTreeTest {

    private CalculationRepository calculationRepository;
    private CustomerRepository customerRepository;
    private CalculationOrderRepository orderRepository;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        calculationRepository = mock(CalculationRepository.class);
        customerRepository = mock(CustomerRepository.class);
        orderRepository = mock(CalculationOrderRepository.class);
        service = new CalculationService(calculationRepository, customerRepository, orderRepository,
                new ObjectMapper(), mock(CalculatorService.class));
    }

    /** Клиент справочника. */
    private Customer customer(String name) {
        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName(name);
        customer.setActive(true);
        return customer;
    }

    /** Заказ клиента. */
    private CalculationOrder order(Customer customer, String number) {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setCustomerId(customer.getId());
        order.setNumber(number);
        order.setOrderDate(LocalDate.of(2026, 10, 30));
        order.setStatus("draft");
        return order;
    }

    /** Версия расчёта с необязательными клиентом, заказом и снапшотом. */
    private Calculation calculation(UUID rootId, int number, UUID parentId, Customer customer,
                                    CalculationOrder order, String totalCost) {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setRootId(rootId);
        calculation.setVersion(number);
        calculation.setParentId(parentId);
        calculation.setName("Расчёт v" + number);
        calculation.setClientName(customer == null ? "Старый клиент" : customer.getName());
        calculation.setManagerName("Иванов");
        calculation.setCustomerId(customer == null ? null : customer.getId());
        calculation.setOrderId(order == null ? null : order.getId());
        calculation.setUpdatedAt(LocalDateTime.now().minusMinutes(number));
        if (totalCost != null) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("totalCost", totalCost);
            calculation.setCalculationResult(snapshot);
        }
        return calculation;
    }

    @Test
    void tree_groupsCalculationsByCustomerAndOrder() {
        Customer romashka = customer("Ромашка");
        Customer lyutik = customer("Лютик");
        CalculationOrder first = order(romashka, "2026-001");
        CalculationOrder second = order(lyutik, "2026-002");

        UUID treeInOrder = UUID.randomUUID();
        Calculation orderRoot = calculation(treeInOrder, 1, null, romashka, first, "100.00");
        Calculation orderTip = calculation(treeInOrder, 2, orderRoot.getId(), romashka, first, "120.00");

        UUID treeWithoutOrder = UUID.randomUUID();
        Calculation loose = calculation(treeWithoutOrder, 1, null, romashka, null, "50.00");

        UUID legacyTree = UUID.randomUUID();
        Calculation legacy = calculation(legacyTree, 1, null, null, null, null);

        when(customerRepository.findAllByOrderByActiveDescNameAsc()).thenReturn(List.of(romashka, lyutik));
        when(orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()).thenReturn(List.of(first, second));
        when(calculationRepository.findByDeletedAtIsNullOrderByUpdatedAtDesc())
                .thenReturn(List.of(orderTip, orderRoot, loose, legacy));

        List<CustomerTreeDto> tree = service.tree();

        assertEquals(3, tree.size());
        CustomerTreeDto romashkaNode = tree.get(0);
        assertEquals("Ромашка", romashkaNode.getName());
        assertEquals(1, romashkaNode.getOrders().size());
        assertEquals(1, romashkaNode.getWithoutOrder().size());
        assertEquals("Расчёт v1", romashkaNode.getWithoutOrder().get(0).getName());

        OrderTreeDto orderNode = romashkaNode.getOrders().get(0);
        assertEquals("2026-001", orderNode.getNumber());
        assertEquals(1, orderNode.getCalculations().size());
        assertEquals(2L, orderNode.getCalculations().get(0).getVersionCount());
        assertEquals(2, orderNode.getCalculations().get(0).getVersion());
        assertEquals(0, new BigDecimal("120.00").compareTo(orderNode.getTotalCost()),
                "в сумму заказа идёт последняя версия расчёта: " + orderNode.getTotalCost());

        CustomerTreeDto lyutikNode = tree.get(1);
        assertEquals("Лютик", lyutikNode.getName());
        assertEquals(1, lyutikNode.getOrders().size(), "заказ без расчётов остаётся видимым");
        assertTrue(lyutikNode.getOrders().get(0).getCalculations().isEmpty());
        assertNull(lyutikNode.getOrders().get(0).getTotalCost());

        CustomerTreeDto legacyNode = tree.get(2);
        assertNull(legacyNode.getId());
        assertEquals("Без клиента", legacyNode.getName());
        assertEquals(1, legacyNode.getWithoutOrder().size());
    }

    @Test
    void tree_countsVersionsOfOneCalculation() {
        Customer romashka = customer("Ромашка");
        CalculationOrder first = order(romashka, "2026-001");

        UUID rootId = UUID.randomUUID();
        Calculation versionOne = calculation(rootId, 1, null, romashka, first, "10.00");
        Calculation versionTwo = calculation(rootId, 2, versionOne.getId(), romashka, first, "20.00");
        Calculation branch = calculation(rootId, 2, versionOne.getId(), romashka, first, "30.00");

        when(customerRepository.findAllByOrderByActiveDescNameAsc()).thenReturn(List.of(romashka));
        when(orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()).thenReturn(List.of(first));
        when(calculationRepository.findByDeletedAtIsNullOrderByUpdatedAtDesc())
                .thenReturn(List.of(branch, versionTwo, versionOne));

        CustomerTreeDto node = service.tree().get(0);

        assertEquals(1, node.getOrders().get(0).getCalculations().size(),
                "дерево версий — один расчёт в заказе, а не три");
        assertEquals(3L, node.getOrders().get(0).getCalculations().get(0).getVersionCount());
        assertEquals(2, node.getOrders().get(0).getCalculations().get(0).getVersion());
    }
}
