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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Client orders: a deal that grows from one calculation version.
 *
 * <p>The client picks the variant they agreed to, so an order points at that
 * version as its source. Every other version stays in the calculation tree, and
 * the same version may later produce another order.
 */
@Service
@RequiredArgsConstructor
public class CalculationOrderService {

    /** Statuses accepted by the database check constraint. */
    private static final Set<String> STATUSES = Set.of("draft", "ready", "sent", "in_work", "closed");

    private final CalculationOrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final CalculationRepository calculationRepository;

    /**
     * Returns orders with the version each one grew from.
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
        Map<UUID, Calculation> sources = sources(orders);

        return orders.stream()
                .map(order -> toDto(order, customerNames.get(order.getCustomerId()), sources))
                .toList();
    }

    /**
     * Returns one order with its source version.
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
        return toDto(order, customerName, sources(List.of(order)));
    }

    /**
     * Creates an order from a calculation version.
     *
     * <p>The client of the order is taken from the version: an order cannot be
     * placed for someone whose calculation does not name a client. A blank
     * number is generated as {@code <year>-<running number>} for the client, so
     * a manager can create a deal without inventing a numbering.
     *
     * @param request order details
     * @return stored order
     * @throws NotFoundException        when the version or its client does not exist
     * @throws IllegalArgumentException when the number is taken or status is unknown
     */
    @Transactional
    public CalculationOrderDto create(CalculationOrderSaveRequest request) {
        Calculation source = calculationRepository.findById(request.getSourceCalculationId())
                .orElseThrow(() -> new NotFoundException(
                        "Версия расчёта не найдена: " + request.getSourceCalculationId()));
        Customer customer = customerOf(source);

        CalculationOrder order = new CalculationOrder();
        order.setCustomerId(customer.getId());
        order.setSourceCalculationId(source.getId());
        order.setOrderDate(request.getOrderDate() != null ? request.getOrderDate() : LocalDate.now());
        order.setStatus(normalizeStatus(request.getStatus(), "draft"));
        order.setComment(trimToNull(request.getComment()));
        order.setNumber(resolveNumber(customer.getId(), request.getNumber()));
        return toDto(orderRepository.save(order), customer.getName(), Map.of(source.getId(), source));
    }

    /**
     * Updates an order.
     *
     * <p>Neither the client nor the source version is movable: moving a deal to
     * another client or variant would silently rewrite what the client agreed to.
     *
     * @param id      order identifier
     * @param request new values
     * @return updated order
     * @throws NotFoundException        when the order does not exist
     * @throws IllegalArgumentException when the number is taken or the source changes
     */
    @Transactional
    public CalculationOrderDto update(UUID id, CalculationOrderSaveRequest request) {
        CalculationOrder order = find(id);
        if (request.getSourceCalculationId() != null
                && !request.getSourceCalculationId().equals(order.getSourceCalculationId())) {
            throw new IllegalArgumentException("Заказ нельзя перенести на другую версию расчёта");
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
        return toDto(order, customerName, sources(List.of(order)));
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
     * Resolves the client of a version.
     *
     * @param source version the order grows from
     * @return its client
     * @throws NotFoundException        when the client row is gone
     * @throws IllegalArgumentException when the version names no client
     */
    private Customer customerOf(Calculation source) {
        if (source.getCustomerId() == null) {
            throw new IllegalArgumentException("У расчёта не указан клиент — сначала выберите клиента");
        }
        return customerRepository.findById(source.getCustomerId())
                .orElseThrow(() -> new NotFoundException("Клиент не найден: " + source.getCustomerId()));
    }

    /**
     * Loads the versions the given orders grew from.
     *
     * @param orders orders to resolve
     * @return versions keyed by id
     */
    private Map<UUID, Calculation> sources(List<CalculationOrder> orders) {
        Set<UUID> ids = new HashSet<>();
        for (CalculationOrder order : orders) {
            if (order.getSourceCalculationId() != null) {
                ids.add(order.getSourceCalculationId());
            }
        }
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Calculation> sources = new HashMap<>();
        calculationRepository.findAllById(ids).forEach(version -> sources.put(version.getId(), version));
        return sources;
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
     * @param order        stored order
     * @param customerName client name for the table
     * @param sources      versions the orders grew from, keyed by id
     * @return order DTO
     */
    private CalculationOrderDto toDto(CalculationOrder order, String customerName,
                                      Map<UUID, Calculation> sources) {
        CalculationOrderDto dto = new CalculationOrderDto();
        dto.setId(order.getId());
        dto.setCustomerId(order.getCustomerId());
        dto.setCustomerName(customerName);
        dto.setNumber(order.getNumber());
        dto.setOrderDate(order.getOrderDate());
        dto.setStatus(order.getStatus());
        dto.setComment(order.getComment());
        dto.setSourceCalculationId(order.getSourceCalculationId());

        Calculation source = order.getSourceCalculationId() == null
                ? null
                : sources.get(order.getSourceCalculationId());
        if (source != null) {
            dto.setSourceVersion(source.getVersion() != null ? source.getVersion() : 1);
            dto.setSourceCalculationName(source.getName());
            dto.setSourceCalculationUpdatedAt(source.getUpdatedAt());
            dto.setTotalCost(totalCostOf(source));
        }

        dto.setCreatedAt(order.getCreatedAt());
        dto.setUpdatedAt(order.getUpdatedAt());
        return dto;
    }

    /**
     * Reads the total cost of a version from its stored snapshot.
     *
     * @param version version row
     * @return total cost, or null when the snapshot is missing
     */
    private BigDecimal totalCostOf(Calculation version) {
        Map<String, Object> stored = version.getCalculationResult();
        if (stored == null) {
            return null;
        }
        Object value = stored.get("totalCost");
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return new BigDecimal(text);
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
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
