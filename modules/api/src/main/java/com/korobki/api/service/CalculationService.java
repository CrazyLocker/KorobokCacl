package com.korobki.api.service;

import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.dto.CalculationVersionDto;
import com.korobki.api.dto.CalculationTreeDto;
import com.korobki.api.dto.CustomerTreeDto;
import com.korobki.api.dto.OrderTreeDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationChainSummary;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalInt;
import java.util.Set;
import java.util.UUID;

/**
 * Service for saving and retrieving calculations.
 *
 * <p>A saved calculation is a version tree: the first save opens it
 * ({@code rootId} = own id, {@code version} = 1, no parent) and every edit adds
 * a child of the version being edited. The number of a version is the depth of
 * its branch ({@code parent.version + 1}), so two branches grown from the same
 * version both continue with the same number — the tree shows where each one
 * came from.
 *
 * <p>Deletion is soft: a deleted version and its subtree are struck through in
 * the history but stay in the database, because the agreement with the client
 * may need the whole chain of changes.
 *
 * <p>The request snapshot is stored next to the result snapshot computed at
 * save time: the stored numbers are what the manager saw, while the snapshot
 * of the request lets the view be recalculated later.
 */
@Service
@RequiredArgsConstructor
public class CalculationService {

    private final CalculationRepository calculationRepository;
    private final CustomerRepository customerRepository;
    private final CalculationOrderRepository orderRepository;
    private final ObjectMapper objectMapper;
    private final CalculatorService calculatorService;

    /**
     * Saves a new calculation as the root of a new version tree.
     *
     * <p>The result is computed before the insert: a calculation the calculator
     * rejects is not stored at all, so the database never keeps a state that
     * cannot be priced.
     *
     * @param request calculation data (name, client, manager, state)
     * @return the saved calculation
     * @throws IllegalArgumentException if the calculator rejects the request
     */
    @Transactional
    public CalculationDto save(CalculationSaveRequest request) {
        CalculationResponse result = calculateOrFail(request.getCalculation());
        Customer customer = resolveCustomer(request.getCustomerId(), request.getClientName());
        CalculationOrder order = resolveOrder(request.getOrderId(), customer);

        Calculation calculation = new Calculation();
        applyMetadata(calculation, request.getName(), customer.getName(), request.getManagerName());
        calculation.setCustomerId(customer.getId());
        calculation.setOrderId(order != null ? order.getId() : null);
        calculation.setStatus("draft");
        calculation.setVersion(1);
        calculation.setCalculationState(convertToMap(request.getCalculation()));
        calculation.setCalculationResult(convertToMap(result));

        // root_id = собственный id: первая версия открывает дерево.
        // Первичный ключ генерируется при вставке, поэтому поле проставляется
        // сразу после save(). Сущность управляемая — UPDATE уходит при коммите.
        Calculation saved = calculationRepository.save(calculation);
        if (saved.getRootId() == null) {
            saved.setRootId(saved.getId());
        }
        return toDto(saved);
    }

    /**
     * Saves an edited calculation as a child of the version it was opened from.
     *
     * <p>Editing version 3 of 5 does not append version 6 at the end of the
     * list: the new version becomes a branch under version 3, so the tree keeps
     * the shape of the work. The metadata (name, client, manager, status) is
     * inherited from the parent, and the parent version stays untouched.
     *
     * @param id      identifier of the version being edited
     * @param request edited calculation request
     * @return the saved version
     * @throws NotFoundException        if the calculation does not exist
     * @throws IllegalArgumentException if the version is deleted or the
     *                                  calculator rejects the request
     */
    @Transactional
    public CalculationDto iterate(UUID id, CalculationRequest request, UUID orderId, boolean detachOrder) {
        Calculation parent = find(id);
        if (parent.getDeletedAt() != null) {
            throw new IllegalArgumentException("Версия помечена удалённой — её нельзя редактировать");
        }

        // Пересчёт до вставки: расчёт, который не считается, не сохраняется.
        CalculationResponse result = calculateOrFail(request);

        Calculation next = new Calculation();
        applyMetadata(next, parent.getName(), parent.getClientName(), parent.getManagerName());
        next.setCustomerId(parent.getCustomerId());
        next.setOrderId(parent.getOrderId());
        next.setStatus(parent.getStatus() != null ? parent.getStatus() : "draft");
        next.setRootId(rootIdOf(parent));
        next.setParentId(parent.getId());
        next.setVersion(versionOf(parent) + 1);
        next.setCalculationState(convertToMap(request));
        next.setCalculationResult(convertToMap(result));

        // Перенос в заказ — событие версии: старые версии остаются без заказа,
        // новая фиксирует, что работа продолжилась уже в заказе.
        applyOrderTarget(next, parent, orderId, detachOrder);

        return toDto(calculationRepository.save(next));
    }

    /**
     * Moves the new version into another order (or out of any order).
     *
     * <p>The order is stored per version, so a transfer is visible in the
     * history: version 3 is «without order», version 4 is «in order 2026-001».
     *
     * @param next        version being created
     * @param parent      version it branches from
     * @param orderId     target order, or null to keep the parent order
     * @param detachOrder true to explicitly clear the order
     * @throws NotFoundException        when the order does not exist
     * @throws IllegalArgumentException when the order belongs to another client
     */
    private void applyOrderTarget(Calculation next, Calculation parent, UUID orderId, boolean detachOrder) {
        if (detachOrder) {
            next.setOrderId(null);
            return;
        }
        if (orderId == null || orderId.equals(parent.getOrderId())) {
            return;
        }
        Customer customer = parent.getCustomerId() == null
                ? null
                : customerRepository.findById(parent.getCustomerId()).orElse(null);
        if (customer == null) {
            throw new IllegalArgumentException("У расчёта не указан клиент — сначала выберите клиента");
        }
        CalculationOrder order = resolveOrder(orderId, customer);
        next.setOrderId(order != null ? order.getId() : null);
        next.setCustomerId(customer.getId());
    }

    /**
     * Lists every live calculation once, most recently updated first.
     *
     * <p>The row points at the tree root, while {@code latestId} points at the
     * newest tip: the list screen continues the main line of work, not the
     * original version. A tree whose versions are all deleted disappears from
     * the list but stays in the database.
     *
     * @return list of saved calculations
     */
    @Transactional(readOnly = true)
    public List<CalculationDto> list() {
        List<CalculationChainSummary> summary = calculationRepository.findChainSummary();
        if (summary.isEmpty()) {
            return List.of();
        }

        Map<UUID, Calculation> roots = new HashMap<>();
        calculationRepository.findAllById(summary.stream().map(CalculationChainSummary::getRootId).toList())
                .forEach(root -> roots.put(root.getId(), root));

        List<CalculationDto> result = new ArrayList<>(summary.size());
        for (CalculationChainSummary row : summary) {
            Calculation root = roots.get(row.getRootId());
            if (root == null) {
                continue;
            }
            List<Calculation> chain = calculationRepository.findByRootIdOrderByVersionAsc(row.getRootId());
            result.add(toListDto(root, row, latestIdOf(chain)));
        }
        return result;
    }

    /**
     * Returns the version tree of a calculation as a flat list, oldest first.
     *
     * <p>The chain is resolved through the root id, so any version id can be
     * passed: the UI opens the history from the row it already knows. The tree
     * is rebuilt by the client from {@code parentId}. The total cost comes from
     * the stored result snapshot, hence versions saved before snapshots
     * existed have {@code totalCost == null} and are shown without a price.
     *
     * @param id identifier of any version of the tree
     * @return versions of the tree, parents before children
     * @throws NotFoundException if the calculation does not exist
     */
    @Transactional(readOnly = true)
    public List<CalculationVersionDto> versions(UUID id) {
        Calculation calculation = find(id);
        List<Calculation> chain = calculationRepository
                .findByRootIdOrderByVersionAsc(rootIdOf(calculation));
        Map<UUID, CalculationOrder> orders = ordersOf(chain);

        Set<UUID> parents = new HashSet<>();
        chain.stream().map(Calculation::getParentId).filter(Objects::nonNull).forEach(parents::add);

        return chain.stream()
                .map(version -> toVersionDto(version, !parents.contains(version.getId()), orders))
                .toList();
    }

    /**
     * Loads the orders referenced by the versions of one tree.
     *
     * <p>One query per tree instead of one per version: the tree screen shows
     * the order number next to the version that entered the order.
     *
     * @param chain versions of one tree
     * @return orders keyed by id
     */
    private Map<UUID, CalculationOrder> ordersOf(List<Calculation> chain) {
        Set<UUID> orderIds = chain.stream()
                .map(Calculation::getOrderId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        if (orderIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, CalculationOrder> orders = new HashMap<>();
        orderRepository.findAllById(orderIds).forEach(order -> orders.put(order.getId(), order));
        return orders;
    }

    /**
     * Returns a saved calculation by its identifier.
     *
     * @param id calculation identifier
     * @return the calculation
     * @throws NotFoundException if not found
     */
    public CalculationDto get(UUID id) {
        return toDto(find(id));
    }

    /**
     * Builds a read-only view of a saved calculation: metadata, the stored
     * request and the result.
     *
     * <p>The result comes from the snapshot saved with the version. Only
     * versions stored before snapshots existed (or with a broken snapshot) are
     * recalculated on the fly, so the view of an old version may differ from
     * the numbers the manager saw if the references changed in the meantime.
     *
     * <p>Broken or incomplete state does not fail the request: the view is
     * returned with {@code viewError} filled in and {@code result} left null.
     *
     * @param id calculation identifier
     * @return read-only calculation view
     * @throws NotFoundException if the calculation does not exist
     */
    @Transactional(readOnly = true)
    public CalculationViewDto view(UUID id) {
        Calculation calculation = find(id);
        return toView(calculation);
    }

    /**
     * Builds the customer → order → calculation tree for the list screen.
     *
     * <p>Calculations without an order are returned in {@code withoutOrder} of
     * their client; rows saved before the reference book existed fall into a
     * bucket with a null customer id. Orders without calculations are still
     * returned, so an empty deal stays visible.
     *
     * @return clients with their orders and calculations
     */
    @Transactional(readOnly = true)
    public List<CustomerTreeDto> tree() {
        Map<UUID, CalculationTreeDto> trees = treesByRoot();

        List<Customer> customers = customerRepository.findAllByOrderByActiveDescNameAsc();
        List<CalculationOrder> orders = orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc();

        Map<UUID, CustomerTreeDto> byCustomer = new LinkedHashMap<>();
        Map<UUID, OrderTreeDto> orderNodes = new HashMap<>();

        for (Customer customer : customers) {
            CustomerTreeDto node = new CustomerTreeDto();
            node.setId(customer.getId());
            node.setName(customer.getName());
            byCustomer.put(customer.getId(), node);
        }

        CustomerTreeDto legacy = new CustomerTreeDto();
        legacy.setName("Без клиента");

        for (CalculationTreeDto calculation : trees.values()) {
            CustomerTreeDto customerNode;
            if (calculation.getCustomerId() == null) {
                customerNode = legacy;
            } else {
                customerNode = byCustomer.computeIfAbsent(calculation.getCustomerId(), id -> {
                    CustomerTreeDto fallback = new CustomerTreeDto();
                    fallback.setId(id);
                    fallback.setName("Клиент удалён");
                    return fallback;
                });
            }

            if (calculation.getOrderId() == null) {
                customerNode.getWithoutOrder().add(calculation);
                continue;
            }
            OrderTreeDto orderNode = orderNodes.computeIfAbsent(calculation.getOrderId(), id -> {
                OrderTreeDto created = new OrderTreeDto();
                created.setId(id);
                return created;
            });
            orderNode.getCalculations().add(calculation);
            if (!customerNode.getOrders().contains(orderNode)) {
                customerNode.getOrders().add(orderNode);
            }
        }

        // Заказы без расчётов: узел всё равно должен быть виден.
        for (CalculationOrder order : orders) {
            OrderTreeDto node = orderNodes.computeIfAbsent(order.getId(), id -> {
                OrderTreeDto created = new OrderTreeDto();
                created.setId(id);
                return created;
            });
            node.setNumber(order.getNumber());
            node.setOrderDate(order.getOrderDate());
            node.setStatus(order.getStatus());
            node.setTotalCost(sumCosts(node.getCalculations()));

            CustomerTreeDto customerNode = byCustomer.get(order.getCustomerId());
            if (customerNode != null && !customerNode.getOrders().contains(node)) {
                customerNode.getOrders().add(node);
            } else if (customerNode == null) {
                // Клиент заказа исчез из справочника — показываем узел отдельно.
                CustomerTreeDto orphan = byCustomer.computeIfAbsent(order.getCustomerId(), id -> {
                    CustomerTreeDto created = new CustomerTreeDto();
                    created.setId(id);
                    created.setName("Клиент удалён");
                    return created;
                });
                if (!orphan.getOrders().contains(node)) {
                    orphan.getOrders().add(node);
                }
            }
        }

        for (CustomerTreeDto customer : byCustomer.values()) {
            customer.getOrders().sort(Comparator
                    .comparing(OrderTreeDto::getOrderDate, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(OrderTreeDto::getNumber, Comparator.nullsLast(Comparator.naturalOrder())));
            customer.getWithoutOrder().sort(Comparator
                    .comparing(CalculationTreeDto::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        }

        List<CustomerTreeDto> result = new ArrayList<>(byCustomer.values());
        if (!legacy.getWithoutOrder().isEmpty()) {
            result.add(legacy);
        }
        return result;
    }

    /**
     * Groups every live calculation tree, keyed by its root id.
     *
     * <p>One query loads the live versions; the tree statistics are computed in
     * memory, which is cheap for a reference book of this size and avoids a
     * query per client.
     *
     * @return tree node per live calculation
     */
    @Transactional(readOnly = true)
    public Map<UUID, CalculationTreeDto> treesByRoot() {
        List<Calculation> live = calculationRepository.findByDeletedAtIsNullOrderByUpdatedAtDesc();
        Map<UUID, List<Calculation>> byRoot = new LinkedHashMap<>();
        for (Calculation version : live) {
            byRoot.computeIfAbsent(rootIdOf(version), key -> new ArrayList<>()).add(version);
        }

        Map<UUID, CalculationTreeDto> trees = new LinkedHashMap<>();
        byRoot.forEach((rootId, chain) -> trees.put(rootId, toTreeDto(rootId, chain)));
        return trees;
    }

    /**
     * Returns the live calculations of one order, newest change first.
     *
     * @param orderId order identifier
     * @return calculations of the order
     */
    @Transactional(readOnly = true)
    public List<CalculationTreeDto> treesByOrder(UUID orderId) {
        return treesByRoot().values().stream()
                .filter(tree -> orderId.equals(tree.getOrderId()))
                .sorted(Comparator.comparing(CalculationTreeDto::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /**
     * Marks a version and its whole subtree as deleted.
     *
     * <p>Nothing is removed from the database: the history of changes is kept
     * for the agreement with the client, and the tree shows deleted versions
     * struck through. Deleting the root hides the whole calculation from the
     * list, deleting a branch leaves the rest of the tree alive.
     *
     * @param id version to delete together with its descendants
     * @throws NotFoundException if the calculation does not exist
     */
    @Transactional
    public void delete(UUID id) {
        Calculation calculation = find(id);
        List<Calculation> chain = calculationRepository
                .findByRootIdOrderByVersionAsc(rootIdOf(calculation));

        Map<UUID, List<Calculation>> childrenByParent = new HashMap<>();
        for (Calculation version : chain) {
            if (version.getParentId() != null) {
                childrenByParent.computeIfAbsent(version.getParentId(), key -> new ArrayList<>()).add(version);
            }
        }

        Set<UUID> subtree = new HashSet<>();
        Deque<UUID> pending = new ArrayDeque<>();
        pending.add(id);
        while (!pending.isEmpty()) {
            UUID current = pending.poll();
            if (!subtree.add(current)) {
                continue;
            }
            childrenByParent.getOrDefault(current, List.of())
                    .forEach(child -> pending.add(child.getId()));
        }

        LocalDateTime now = LocalDateTime.now();
        chain.stream()
                .filter(version -> subtree.contains(version.getId()) && version.getDeletedAt() == null)
                .forEach(version -> version.setDeletedAt(now));
    }

    /**
     * Resolves the print/assembly conflict of legacy saved states.
     *
     * <p>Assembly mode prints the details itself, so it is mutually exclusive
     * with single-detail print and the calculator rejects a request with both
     * flags on. Old saves may carry both: the assembly flag wins and
     * single-detail print is switched off in the view, so the stored snapshot
     * still opens instead of failing with a validation error.
     *
     * <p>The state in the database is not touched — only the parsed request
     * of the view response.
     *
     * @param request parsed stored request, modified in place
     */
    private void normalizeModeFlags(CalculationRequest request) {
        if (request.getAssemblySettings() == null
                || !Boolean.TRUE.equals(request.getAssemblySettings().getEnabled())) {
            return;
        }
        if (request.getPrintSettings() != null
                && Boolean.TRUE.equals(request.getPrintSettings().getEnabled())) {
            request.getPrintSettings().setEnabled(false);
        }
    }

    /**
     * Checks the fields the calculator cannot work without.
     *
     * @param request parsed stored request
     * @return reason the request is incomplete, or null when it is usable
     */
    private String findIncomplete(CalculationRequest request) {
        if (request.getConstruction() == null || request.getConstruction().isBlank()) {
            return "не указана конструкция";
        }
        if (request.getDetails() == null || request.getDetails().isEmpty()) {
            return "нет деталей";
        }
        if (request.getWorkPrice() == null) {
            return "не указана работа за деталь";
        }
        return null;
    }

    /**
     * Reads the stored result snapshot.
     *
     * @param stored JSON snapshot of the result, may be null
     * @return parsed result, or null when there is nothing usable to show
     */
    private CalculationResponse readSnapshot(Map<String, Object> stored) {
        if (stored == null || stored.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.convertValue(stored, CalculationResponse.class);
        } catch (IllegalArgumentException ex) {
            // Снапшот старее текущего формата ответа — показываем пересчёт.
            return null;
        }
    }

    /**
     * Calculates the request and refuses to continue when it cannot be priced.
     *
     * @param request calculation request to price
     * @return calculation result
     * @throws IllegalArgumentException if the request is missing or rejected
     */
    private CalculationResponse calculateOrFail(CalculationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Расчёт не передан");
        }
        CalculationResponse response = calculatorService.calculate(request);
        if (response == null) {
            throw new IllegalArgumentException("Калькулятор не вернул результат");
        }
        return response;
    }

    /**
     * Loads a version or fails with the REST error the controller maps to 404.
     *
     * @param id calculation identifier
     * @return the stored version
     * @throws NotFoundException if the calculation does not exist
     */
    private Calculation find(UUID id) {
        return calculationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Расчёт не найден: " + id));
    }

    /**
     * Copies the attribution fields into an entity.
     *
     * @param calculation entity to fill
     * @param name        calculation name
     * @param clientName  client the calculation was made for
     * @param managerName manager who made it
     */
    private void applyMetadata(Calculation calculation, String name, String clientName, String managerName) {
        calculation.setName(name);
        calculation.setClientName(clientName);
        calculation.setManagerName(managerName);
    }

    /**
     * Returns the tree identifier of a version.
     *
     * @param calculation any version of the tree
     * @return root identifier; the own id for rows saved before versioning
     */
    private UUID rootIdOf(Calculation calculation) {
        return calculation.getRootId() != null ? calculation.getRootId() : calculation.getId();
    }

    /**
     * Finds the newest tip of a live tree.
     *
     * <p>A tree may have several tips after branching, so the list row points
     * at the tip that changed last — that is the line the manager was working
     * on.
     *
     * @param chain versions of one tree, oldest first
     * @return identifier of the newest live tip, or null when everything is
     *         deleted
     */
    private UUID latestIdOf(List<Calculation> chain) {
        Set<UUID> parentsOfLive = new HashSet<>();
        for (Calculation version : chain) {
            if (version.getDeletedAt() == null && version.getParentId() != null) {
                parentsOfLive.add(version.getParentId());
            }
        }
        return chain.stream()
                .filter(version -> version.getDeletedAt() == null)
                .filter(version -> !parentsOfLive.contains(version.getId()))
                .max(Comparator.comparing(Calculation::getUpdatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(Calculation::getId)
                .orElse(null);
    }

    /**
     * Extracts a human-readable reason from an exception.
     *
     * @param ex failure raised while parsing or recalculating
     * @return exception message, or the class name when the message is empty
     */
    private String describe(RuntimeException ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? ex.getClass().getSimpleName() : message;
    }

    /**
     * Converts an arbitrary request object into a JSON-friendly map.
     *
     * @param request object to convert
     * @return map representation
     */
    private Map<String, Object> convertToMap(Object request) {
        return objectMapper.convertValue(request, new TypeReference<Map<String, Object>>() { });
    }

    /**
     * Maps a calculation entity to a history entry.
     *
     * @param calculation version to map
     * @param latest      whether the version is a tip of the tree
     * @param orders      orders referenced by the tree, keyed by id
     * @return version DTO
     */
    private CalculationVersionDto toVersionDto(Calculation calculation, boolean latest,
                                               Map<UUID, CalculationOrder> orders) {
        CalculationVersionDto dto = new CalculationVersionDto();
        dto.setId(calculation.getId());
        dto.setVersion(versionOf(calculation));
        dto.setParentId(calculation.getParentId());
        dto.setDeleted(calculation.getDeletedAt() != null);
        dto.setName(calculation.getName());
        dto.setClientName(calculation.getClientName());
        dto.setManagerName(calculation.getManagerName());
        dto.setStatus(calculation.getStatus());
        dto.setTotalCost(totalCostOf(calculation.getCalculationResult()));
        dto.setOrderId(calculation.getOrderId());
        CalculationOrder order = calculation.getOrderId() == null ? null : orders.get(calculation.getOrderId());
        dto.setOrderNumber(order != null ? order.getNumber() : null);
        dto.setLatest(latest);
        dto.setCreatedAt(calculation.getCreatedAt());
        dto.setUpdatedAt(calculation.getUpdatedAt());
        return dto;
    }

    /**
     * Returns the version number, defaulting rows saved before versioning to 1.
     *
     * @param calculation version row
     * @return version number
     */
    private int versionOf(Calculation calculation) {
        return calculation.getVersion() != null ? calculation.getVersion() : 1;
    }

    /**
     * Reads the total cost out of a stored result snapshot.
     *
     * <p>JSON numbers may arrive as {@code Integer}, {@code Double} or
     * {@code BigDecimal} depending on the value, so the conversion goes
     * through the textual form.
     *
     * @param stored JSON snapshot of the result, may be null
     * @return total cost, or null when the snapshot is missing or has no price
     */
    private BigDecimal totalCostOf(Map<String, Object> stored) {
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
     * Builds the view of a stored version.
     *
     * @param calculation stored version
     * @return read-only view; {@code viewError} explains what cannot be shown
     */
    private CalculationViewDto toView(Calculation calculation) {
        CalculationViewDto view = new CalculationViewDto();
        view.setId(calculation.getId());
        view.setName(calculation.getName());
        view.setClientName(calculation.getClientName());
        view.setManagerName(calculation.getManagerName());
        view.setStatus(calculation.getStatus());
        view.setVersion(calculation.getVersion());
        view.setParentId(calculation.getParentId());
        view.setDeleted(calculation.getDeletedAt() != null);
        view.setCreatedAt(calculation.getCreatedAt());
        view.setUpdatedAt(calculation.getUpdatedAt());

        Map<String, Object> state = calculation.getCalculationState();
        if (state == null || state.isEmpty()) {
            view.setViewError("Сохранённый расчёт пуст: нет входных данных");
            return view;
        }

        CalculationRequest request;
        try {
            request = objectMapper.convertValue(state, CalculationRequest.class);
        } catch (IllegalArgumentException ex) {
            view.setViewError("Не удалось разобрать сохранённый расчёт: " + describe(ex));
            return view;
        }
        if (request == null) {
            view.setViewError("Не удалось разобрать сохранённый расчёт: пустой запрос");
            return view;
        }
        normalizeModeFlags(request);
        view.setRequest(request);

        String incomplete = findIncomplete(request);
        if (incomplete != null) {
            view.setViewError("Не удалось пересчитать: " + incomplete);
            return view;
        }

        CalculationResponse snapshot = readSnapshot(calculation.getCalculationResult());
        if (snapshot != null) {
            view.setResult(snapshot);
            return view;
        }

        try {
            view.setResult(calculatorService.calculate(request));
        } catch (RuntimeException ex) {
            view.setResult(null);
            view.setViewError("Не удалось пересчитать: " + describe(ex));
        }
        return view;
    }

    /**
     * Maps the tree root and its statistics to a list row.
     *
     * @param root     root version of the tree
     * @param summary  aggregated numbers of the tree
     * @param latestId newest tip of the tree
     * @return calculation DTO
     */
    private CalculationDto toListDto(Calculation root, CalculationChainSummary summary, UUID latestId) {
        CalculationDto dto = toDto(root);
        dto.setVersion(summary.getVersion());
        dto.setVersionCount(summary.getVersionCount());
        dto.setLatestId(latestId);
        dto.setUpdatedAt(summary.getLastUpdated());
        return dto;
    }

    /**
     * Maps a calculation entity to its DTO.
     *
     * @param calculation entity to map
     * @return calculation DTO
     */
    private CalculationDto toDto(Calculation calculation) {
        CalculationDto dto = new CalculationDto();
        dto.setId(calculation.getId());
        dto.setRootId(calculation.getRootId());
        dto.setVersion(versionOf(calculation));
        dto.setParentId(calculation.getParentId());
        dto.setName(calculation.getName());
        dto.setClientName(calculation.getClientName());
        dto.setCustomerId(calculation.getCustomerId());
        dto.setOrderId(calculation.getOrderId());
        dto.setManagerName(calculation.getManagerName());
        dto.setStatus(calculation.getStatus());
        dto.setCalculation(calculation.getCalculationState());
        dto.setCreatedAt(calculation.getCreatedAt());
        dto.setUpdatedAt(calculation.getUpdatedAt());
        return dto;
    }

    /**
     * Builds the list node of one calculation tree.
     *
     * @param rootId identifier of the first version
     * @param chain  live versions of the tree
     * @return tree node with the statistics of its newest version
     */
    private CalculationTreeDto toTreeDto(UUID rootId, List<Calculation> chain) {
        Calculation root = chain.stream()
                .filter(version -> version.getId().equals(rootId))
                .findFirst()
                .orElse(chain.get(0));
        UUID latestId = latestIdOf(chain);
        Calculation latest = chain.stream()
                .filter(version -> version.getId().equals(latestId))
                .findFirst()
                .orElse(root);

        CalculationTreeDto dto = new CalculationTreeDto();
        dto.setId(root.getId());
        dto.setCustomerId(latest.getCustomerId() != null ? latest.getCustomerId() : root.getCustomerId());
        // Заказ берётся у свежей ветки: перенос в заказ — событие версии,
        // поэтому расчёт числится в заказе, начиная с той версии, где его завели.
        dto.setOrderId(latest.getOrderId());
        dto.setOrderSinceVersion(orderSinceVersion(chain, latest.getOrderId()));
        dto.setName(root.getName());
        dto.setManagerName(root.getManagerName());
        dto.setLatestId(latestId);
        dto.setVersion(chain.stream().mapToInt(this::versionOf).max().orElse(1));
        dto.setVersionCount((long) chain.size());
        dto.setTotalCost(totalCostOf(latest.getCalculationResult()));
        dto.setUpdatedAt(chain.stream()
                .map(Calculation::getUpdatedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null));
        return dto;
    }

    /**
     * Returns the version the calculation entered the given order with.
     *
     * <p>The order is stored per version, so «в заказе с v3» is the earliest
     * version of the live chain that already carries this order.
     *
     * @param chain   live versions of the tree
     * @param orderId current order of the tree, may be null
     * @return version number, or null when the calculation has no order
     */
    private Integer orderSinceVersion(List<Calculation> chain, UUID orderId) {
        if (orderId == null) {
            return null;
        }
        OptionalInt first = chain.stream()
                .filter(version -> orderId.equals(version.getOrderId()))
                .mapToInt(this::versionOf)
                .min();
        return first.isPresent() ? first.getAsInt() : null;
    }

    /**
     * Sums the costs of the calculations; null when none of them is priced.
     *
     * @param calculations trees of one order
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
     * Resolves the client of a save request.
     *
     * <p>An explicit id wins; otherwise the name from older clients of the API
     * is matched case-insensitively and created on the fly when unknown, so the
     * reference book fills itself from the existing workflow.
     *
     * @param customerId explicit client id, may be null
     * @param clientName client name from the legacy request field
     * @return the stored client
     * @throws NotFoundException        when the id points at nothing
     * @throws IllegalArgumentException when neither id nor name is given
     */
    private Customer resolveCustomer(UUID customerId, String clientName) {
        if (customerId != null) {
            return customerRepository.findById(customerId)
                    .orElseThrow(() -> new NotFoundException("Клиент не найден: " + customerId));
        }
        if (clientName == null || clientName.isBlank()) {
            throw new IllegalArgumentException("Укажите клиента");
        }
        String name = clientName.trim();
        return customerRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> {
                    Customer created = new Customer();
                    created.setName(name);
                    return customerRepository.save(created);
                });
    }

    /**
     * Resolves the order of a save request and checks it belongs to the client.
     *
     * @param orderId  explicit order id, may be null for "no order yet"
     * @param customer resolved client of the calculation
     * @return the stored order, or null
     * @throws NotFoundException        when the order does not exist
     * @throws IllegalArgumentException when the order belongs to another client
     */
    private CalculationOrder resolveOrder(UUID orderId, Customer customer) {
        if (orderId == null) {
            return null;
        }
        CalculationOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Заказ не найден: " + orderId));
        if (!order.getCustomerId().equals(customer.getId())) {
            throw new IllegalArgumentException("Заказ принадлежит другому клиенту");
        }
        return order;
    }
}
