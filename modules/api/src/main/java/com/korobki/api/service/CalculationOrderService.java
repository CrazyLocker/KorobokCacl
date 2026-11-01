package com.korobki.api.service;

import com.korobki.api.dto.CalculationOrderDto;
import com.korobki.api.dto.CalculationOrderSaveRequest;
import com.korobki.api.dto.CalculationTreeDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Orders (deals) that group calculations of one client.
 */
@Service
@RequiredArgsConstructor
public class CalculationOrderService {

    /** Statuses accepted by the database check constraint. */
    private static final Set<String> STATUSES = Set.of("draft", "ready", "sent", "in_work", "closed");

    private final CalculationOrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final CalculationService calculationService;

    /**
     * Returns orders with the number and cost of their calculations.
     *
     * @param customerId optional client filter
     * @return orders, newest first
     */
    @Transactional(readOnly = true)
    public List<CalculationOrderDto> list(UUID customerId) {
        List<CalculationOrder> orders = customerId == null
                ? orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc()
                : orderRepository.findByCustomerIdOrderByOrderDateDescCreatedAtDesc(customerId);

        Map<UUID, String> customerNames = customerRepository.findAll().stream()
                .collect(Collectors.toMap(Customer::getId, Customer::getName));
        Map<UUID, List<CalculationTreeDto>> byOrder = calculationsByOrder();

        return orders.stream()
                .map(order -> toDto(order, customerNames.get(order.getCustomerId()),
                        byOrder.getOrDefault(order.getId(), List.of())))
                .toList();
    }

    /**
     * Returns one order with its calculations.
     *
     * @param id order identifier
     * @return order DTO
     * @throws NotFoundException when the order does not exist
     */
    @Transactional(readOnly = true)
    public CalculationOrderDto get(UUID id) {
        CalculationOrder order = find(id);
        String customerName = customerRepository.findById(order.getCustomerId())
                .map(Customer::getName)
                .orElse("Клиент удалён");
        return toDto(order, customerName, calculationsByOrder().getOrDefault(id, List.of()));
    }

    /**
     * Creates an order.
     *
     * <p>A blank number is generated as {@code <year>-<running number>} for the
     * client, so a manager can create a deal without inventing a numbering.
     *
     * @param request order details
     * @return stored order
     * @throws NotFoundException        when the client does not exist
     * @throws IllegalArgumentException when the number is taken or status is unknown
     */
    @Transactional
    public CalculationOrderDto create(CalculationOrderSaveRequest request) {
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new NotFoundException("Клиент не найден: " + request.getCustomerId()));

        CalculationOrder order = new CalculationOrder();
        order.setCustomerId(customer.getId());
        order.setOrderDate(request.getOrderDate() != null ? request.getOrderDate() : LocalDate.now());
        order.setStatus(normalizeStatus(request.getStatus(), "draft"));
        order.setComment(trimToNull(request.getComment()));
        order.setNumber(resolveNumber(customer.getId(), request.getNumber()));
        return toDto(orderRepository.save(order), customer.getName(), List.of());
    }

    /**
     * Updates an order.
     *
     * <p>The client is not movable: moving a deal to another client would
     * silently change who the calculations belong to.
     *
     * @param id      order identifier
     * @param request new values
     * @return updated order
     * @throws NotFoundException        when the order or its client does not exist
     * @throws IllegalArgumentException when the number is taken or the client changes
     */
    @Transactional
    public CalculationOrderDto update(UUID id, CalculationOrderSaveRequest request) {
        CalculationOrder order = find(id);
        if (!order.getCustomerId().equals(request.getCustomerId())) {
            throw new IllegalArgumentException("Заказ нельзя передать другому клиенту");
        }

        order.setNumber(resolveNumberForUpdate(order, request.getNumber()));
        if (request.getOrderDate() != null) {
            order.setOrderDate(request.getOrderDate());
        }
        order.setStatus(normalizeStatus(request.getStatus(), order.getStatus()));
        order.setComment(trimToNull(request.getComment()));

        String customerName = customerRepository.findById(order.getCustomerId())
                .map(Customer::getName)
                .orElse("Клиент удалён");
        return toDto(order, customerName, calculationsByOrder().getOrDefault(id, List.of()));
    }

    /**
     * Loads an order or fails with a not-found error.
     *
     * @param id order identifier
     * @return stored order
     * @throws NotFoundException when the order does not exist
     */
    @Transactional(readOnly = true)
    public CalculationOrder find(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Заказ не найден: " + id));
    }

    /**
     * Groups the live calculation trees by order.
     *
     * @return calculations per order id
     */
    private Map<UUID, List<CalculationTreeDto>> calculationsByOrder() {
        Map<UUID, List<CalculationTreeDto>> byOrder = new HashMap<>();
        for (CalculationTreeDto tree : calculationService.treesByRoot().values()) {
            if (tree.getOrderId() != null) {
                byOrder.computeIfAbsent(tree.getOrderId(), key -> new ArrayList<>()).add(tree);
            }
        }
        byOrder.values().forEach(list -> list.sort(Comparator
                .comparing(CalculationTreeDto::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder()))));
        return byOrder;
    }

    /**
     * Picks the order number on creation.
     *
     * @param customerId client identifier
     * @param requested  number typed by the manager, may be blank
     * @return unique number for the client
     */
    private String resolveNumber(UUID customerId, String requested) {
        if (requested != null && !requested.isBlank()) {
            String number = requested.trim();
            orderRepository.findByCustomerIdAndNumberIgnoreCase(customerId, number).ifPresent(existing -> {
                throw new IllegalArgumentException("Заказ с номером «" + number + "» уже есть у клиента");
            });
            return number;
        }

        int year = LocalDate.now().getYear();
        String prefix = year + "-";
        long used = orderRepository.findByCustomerIdOrderByOrderDateDescCreatedAtDesc(customerId).stream()
                .map(CalculationOrder::getNumber)
                .filter(number -> number != null && number.startsWith(prefix))
                .count();
        return prefix + String.format("%03d", used + 1);
    }

    /**
     * Picks the order number on update, keeping the current one when unchanged.
     *
     * @param order     stored order
     * @param requested number typed by the manager, may be blank
     * @return unique number for the client
     */
    private String resolveNumberForUpdate(CalculationOrder order, String requested) {
        if (requested == null || requested.isBlank() || requested.trim().equals(order.getNumber())) {
            return order.getNumber();
        }
        String number = requested.trim();
        orderRepository.findByCustomerIdAndNumberIgnoreCase(order.getCustomerId(), number)
                .filter(other -> !other.getId().equals(order.getId()))
                .ifPresent(other -> {
                    throw new IllegalArgumentException("Заказ с номером «" + number + "» уже есть у клиента");
                });
        return number;
    }

    /**
     * Validates a status against the database constraint.
     *
     * @param requested typed status, may be null
     * @param fallback  status to keep when nothing is requested
     * @return valid status
     */
    private String normalizeStatus(String requested, String fallback) {
        if (requested == null || requested.isBlank()) {
            return fallback;
        }
        String status = requested.trim();
        if (!STATUSES.contains(status)) {
            throw new IllegalArgumentException("Неизвестный статус заказа «" + status
                    + "». Допустимые: " + String.join(", ", STATUSES));
        }
        return status;
    }

    /**
     * Maps an order entity to its DTO.
     *
     * @param order         stored order
     * @param customerName  client name for the table
     * @param calculations  live calculations of the order
     * @return order DTO
     */
    private CalculationOrderDto toDto(CalculationOrder order, String customerName,
                                      List<CalculationTreeDto> calculations) {
        CalculationOrderDto dto = new CalculationOrderDto();
        dto.setId(order.getId());
        dto.setCustomerId(order.getCustomerId());
        dto.setCustomerName(customerName);
        dto.setNumber(order.getNumber());
        dto.setOrderDate(order.getOrderDate());
        dto.setStatus(order.getStatus());
        dto.setComment(order.getComment());
        dto.setCalculationCount((long) calculations.size());
        dto.setTotalCost(sumCosts(calculations));
        dto.setCreatedAt(order.getCreatedAt());
        dto.setUpdatedAt(order.getUpdatedAt());
        return dto;
    }

    /**
     * Sums the costs of the calculations; null when none is priced.
     *
     * @param calculations trees of the order
     * @return order total, or null when empty
     */
    private BigDecimal sumCosts(List<CalculationTreeDto> calculations) {
        BigDecimal total = null;
        for (CalculationTreeDto calculation : calculations) {
            if (calculation.getTotalCost() == null) {
                continue;
            }
            total = total == null ? calculation.getTotalCost() : total.add(calculation.getTotalCost());
        }
        return total;
    }

    /**
     * Trims a nullable string, turning blanks into null.
     *
     * @param value raw value
     * @return trimmed value or null
     */
    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
