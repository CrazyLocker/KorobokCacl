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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Проверяет дерево «Клиент → Заказ/Расчёт»: заказ вырастает из одной версии,
 * но сама версия и весь расчёт остаются в дереве клиента; старые строки без
 * клиента попадают в отдельную корзину.
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

    /** Заказ, выросший из версии расчёта. */
    private CalculationOrder order(Customer customer, String number, Calculation source) {
        CalculationOrder order = new CalculationOrder();
        order.setId(UUID.randomUUID());
        order.setCustomerId(customer.getId());
        order.setNumber(number);
        order.setOrderDate(LocalDate.of(2026, 10, 30));
        order.setStatus("draft");
        order.setSourceCalculationId(source == null ? null : source.getId());
        return order;
    }

    /** Версия расчёта с необязательными клиентом и снапшотом. */
    private Calculation calculation(UUID rootId, int number, UUID parentId, Customer customer,
                                    String totalCost) {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setRootId(rootId);
        calculation.setVersion(number);
        calculation.setParentId(parentId);
        calculation.setName("Расчёт v" + number);
        calculation.setClientName(customer == null ? "Старый клиент" : customer.getName());
        calculation.setManagerName("Иванов");
        calculation.setCustomerId(customer == null ? null : customer.getId());
        calculation.setUpdatedAt(LocalDateTime.now().minusMinutes(number));
        if (totalCost != null) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("totalCost", totalCost);
            calculation.setCalculationResult(snapshot);
        }
        return calculation;
    }

    @Test
    void tree_listsOrdersNextToCalculationsOfTheSameClient() {
        Customer romashka = customer("Ромашка");
        Customer lyutik = customer("Лютик");

        UUID orderedTree = UUID.randomUUID();
        Calculation orderedRoot = calculation(orderedTree, 1, null, romashka, "100.00");
        Calculation orderedTip = calculation(orderedTree, 2, orderedRoot.getId(), romashka, "120.00");
        CalculationOrder first = order(romashka, "2026-001", orderedTip);

        UUID looseTree = UUID.randomUUID();
        Calculation loose = calculation(looseTree, 1, null, romashka, "50.00");

        UUID legacyTree = UUID.randomUUID();
        Calculation legacy = calculation(legacyTree, 1, null, null, null);

        when(customerRepository.findAllByOrderByActiveDescNameAsc()).thenReturn(List.of(romashka, lyutik));
        when(orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()).thenReturn(List.of(first));
        when(calculationRepository.findByDeletedAtIsNullOrderByUpdatedAtDesc())
                .thenReturn(List.of(orderedTip, orderedRoot, loose, legacy));
        when(calculationRepository.findAllById(any()))
                .thenReturn(List.of(orderedTip));

        List<CustomerTreeDto> tree = service.tree();

        assertEquals(3, tree.size());
        CustomerTreeDto romashkaNode = tree.get(0);
        assertEquals("Ромашка", romashkaNode.getName());
        assertEquals(2, romashkaNode.getCalculations().size(),
                "расчёт остаётся у клиента и после заказа");
        assertEquals(1, romashkaNode.getOrders().size());

        OrderTreeDto orderNode = romashkaNode.getOrders().get(0);
        assertEquals("2026-001", orderNode.getNumber());
        assertEquals(orderedTip.getId(), orderNode.getSourceCalculationId());
        assertEquals(2, orderNode.getSourceVersion(), "заказ вырос из второй версии");
        assertEquals("Расчёт v2", orderNode.getSourceCalculationName());
        assertEquals(0, new BigDecimal("120.00").compareTo(orderNode.getTotalCost()),
                "в сумму заказа идёт версия-источник: " + orderNode.getTotalCost());

        CustomerTreeDto lyutikNode = tree.get(1);
        assertEquals("Лютик", lyutikNode.getName());
        assertTrue(lyutikNode.getOrders().isEmpty());
        assertTrue(lyutikNode.getCalculations().isEmpty());

        CustomerTreeDto legacyNode = tree.get(2);
        assertNull(legacyNode.getId());
        assertEquals("Без клиента", legacyNode.getName());
        assertEquals(1, legacyNode.getCalculations().size());
    }

    @Test
    void tree_countsVersionsOfOneCalculation() {
        Customer romashka = customer("Ромашка");

        UUID rootId = UUID.randomUUID();
        Calculation versionOne = calculation(rootId, 1, null, romashka, "10.00");
        Calculation versionTwo = calculation(rootId, 2, versionOne.getId(), romashka, "20.00");
        Calculation branch = calculation(rootId, 2, versionOne.getId(), romashka, "30.00");
        CalculationOrder first = order(romashka, "2026-001", versionOne);

        when(customerRepository.findAllByOrderByActiveDescNameAsc()).thenReturn(List.of(romashka));
        when(orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()).thenReturn(List.of(first));
        when(calculationRepository.findByDeletedAtIsNullOrderByUpdatedAtDesc())
                .thenReturn(List.of(branch, versionTwo, versionOne));
        when(calculationRepository.findAllById(any()))
                .thenReturn(List.of(versionOne));

        CustomerTreeDto node = service.tree().get(0);

        assertEquals(1, node.getCalculations().size(), "три версии — это один расчёт, а не три");
        assertEquals(3L, node.getCalculations().get(0).getVersionCount());
        assertEquals(2, node.getCalculations().get(0).getVersion());

        assertEquals(1, node.getOrders().size());
        assertEquals(1, node.getOrders().get(0).getSourceVersion(),
                "заказ вырос из первой версии, хотя у расчёта уже есть ветки");
    }
}
