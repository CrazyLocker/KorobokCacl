package com.korobki.api.service;

import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.dto.CalculationVersionDto;
import com.korobki.api.dto.CalculationTreeDto;
import com.korobki.api.dto.CalculationVersionOrderDto;
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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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

        Calculation calculation = new Calculation();
        applyMetadata(calculation, request.getName(), customer.getName(), request.getManagerName());
        calculation.setCustomerId(customer.getId());
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
    public CalculationDto iterate(UUID id, CalculationRequest request) {
        Calculation parent = find(id);
        if (parent.getDeletedAt() != null) {
            throw new IllegalArgumentException("Версия помечена удалённой — её нельзя редактировать");
        }

        // Пересчёт до вставки: расчёт, который не считается, не сохраняется.
        CalculationResponse result = calculateOrFail(request);

        Calculation next = new Calculation();
        applyMetadata(next, parent.getName(), parent.getClientName(), parent.getManagerName());
        next.setCustomerId(parent.getCustomerId());
        next.setStatus(parent.getStatus() != null ? parent.getStatus() : "draft");
        next.setRootId(rootIdOf(parent));
        next.setParentId(parent.getId());
        next.setVersion(versionOf(parent) + 1);
        next.setCalculationState(convertToMap(request));
        next.setCalculationResult(convertToMap(result));

        return toDto(calculationRepository.save(next));
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
        Map<UUID, List<CalculationVersionOrderDto>> orders = ordersBySourceVersion(chain);

        Set<UUID> parents = new HashSet<>();
        chain.stream().map(Calculation::getParentId).filter(Objects::nonNull).forEach(parents::add);

        return chain.stream()
                .map(version -> toVersionDto(
                        version,
                        !parents.contains(version.getId()),
                        orders.getOrDefault(version.getId(), List.of())))
                .toList();
    }

    /**
     * Collects the orders that grew from the versions of one tree.
     *
     * <p>One query for the whole tree: each version shows the orders placed from
     * it, so the manager can see which variant the client actually bought.
     *
     * @param chain versions of one tree
     * @return orders grouped by the version they grew from
     */
    private Map<UUID, List<CalculationVersionOrderDto>> ordersBySourceVersion(List<Calculation> chain) {
        if (chain.isEmpty()) {
            return Map.of();
        }
        List<UUID> versionIds = chain.stream().map(Calculation::getId).toList();
        Map<UUID, List<CalculationVersionOrderDto>> byVersion = new HashMap<>();
        for (CalculationOrder order : orderRepository.findBySourceCalculationIdIn(versionIds)) {
            if (order.getSourceCalculationId() == null) {
                continue;
            }
            byVersion.computeIfAbsent(order.getSourceCalculationId(), key -> new ArrayList<>())
                    .add(new CalculationVersionOrderDto(order.getId(), order.getNumber()));
        }
        byVersion.values().forEach(orders -> orders.sort(
                Comparator.comparing(CalculationVersionOrderDto::getNumber,
                        Comparator.nullsLast(Comparator.naturalOrder()))));
        return byVersion;
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
     * Builds the customer → order/calculation tree for the list screen.
     *
     * <p>Orders are not containers of calculations anymore: an order grows from
     * one version, so it is listed next to the client with the version it came
     * from, while every calculation tree stays in the client's own list. Rows
     * saved before the reference book existed fall into a bucket with a null
     * customer id.
     *
     * @return clients with their orders and calculations
     */
    @Transactional(readOnly = true)
    public List<CustomerTreeDto> tree() {
        Map<UUID, CalculationTreeDto> trees = treesByRoot();

        List<Customer> customers = customerRepository.findAllByOrderByActiveDescNameAsc();
        List<CalculationOrder> orders = orderRepository.findAllByOrderByOrderDateDescCreatedAtDesc();

        Map<UUID, CustomerTreeDto> byCustomer = new LinkedHashMap<>();
        for (Customer customer : customers) {
            CustomerTreeDto node = new CustomerTreeDto();
            node.setId(customer.getId());
            node.setName(customer.getName());
            byCustomer.put(customer.getId(), node);
        }

        CustomerTreeDto legacy = new CustomerTreeDto();
        legacy.setName("Без клиента");

        for (CalculationTreeDto calculation : trees.values()) {
            customerNode(byCustomer, legacy, calculation.getCustomerId())
                    .getCalculations().add(calculation);
        }

        Map<UUID, Calculation> sources = sourceVersions(orders);
        for (CalculationOrder order : orders) {
            OrderTreeDto node = new OrderTreeDto();
            node.setId(order.getId());
            node.setNumber(order.getNumber());
            node.setOrderDate(order.getOrderDate());
            node.setStatus(order.getStatus());
            node.setCustomerId(order.getCustomerId());
            node.setDeleted(order.getDeletedAt() != null);

            Calculation source = order.getSourceCalculationId() == null
                    ? null
                    : sources.get(order.getSourceCalculationId());
            if (source != null) {
                node.setSourceCalculationId(source.getId());
                node.setSourceVersion(versionOf(source));
                node.setSourceCalculationName(source.getName());
                node.setSourceCalculationUpdatedAt(source.getUpdatedAt());
                CalculationTreeDto tree = trees.get(rootIdOf(source));
                node.setSourceCalculationLatestId(tree != null ? tree.getLatestId() : source.getId());
                BigDecimal snapshot = totalCostOf(source.getCalculationResult());
                node.setTotalCost(snapshot != null ? snapshot : (tree != null ? tree.getTotalCost() : null));
            }

            customerNode(byCustomer, legacy, order.getCustomerId()).getOrders().add(node);
        }

        for (CustomerTreeDto customer : byCustomer.values()) {
            customer.getOrders().sort(Comparator
                    .comparing(OrderTreeDto::getOrderDate, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(OrderTreeDto::getNumber, Comparator.nullsLast(Comparator.naturalOrder())));
            customer.getCalculations().sort(Comparator
                    .comparing(CalculationTreeDto::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        }

        List<CustomerTreeDto> result = new ArrayList<>(byCustomer.values());
        if (!legacy.getCalculations().isEmpty() || !legacy.getOrders().isEmpty()) {
            result.add(legacy);
        }
        return result;
    }

    /**
     * Finds the client node of a tree row, creating a placeholder for rows whose
     * client left the reference book.
     *
     * @param byCustomer clients keyed by id
     * @param legacy     bucket for rows without any client
     * @param customerId client of the row, may be null
     * @return node the row belongs to
     */
    private CustomerTreeDto customerNode(Map<UUID, CustomerTreeDto> byCustomer,
                                         CustomerTreeDto legacy, UUID customerId) {
        if (customerId == null) {
            return legacy;
        }
        return byCustomer.computeIfAbsent(customerId, id -> {
            CustomerTreeDto fallback = new CustomerTreeDto();
            fallback.setId(id);
            fallback.setName("Клиент удалён");
            return fallback;
        });
    }

    /**
     * Loads the versions the orders grew from.
     *
     * @param orders orders of the tree screen
     * @return versions keyed by id
     */
    private Map<UUID, Calculation> sourceVersions(List<CalculationOrder> orders) {
        Set<UUID> ids = orders.stream()
                .map(CalculationOrder::getSourceCalculationId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Calculation> sources = new HashMap<>();
        calculationRepository.findAllById(ids).forEach(version -> sources.put(version.getId(), version));
        return sources;
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
        // Удалённые версии тоже нужны: дерево показывает историю зачёркнутой,
        // а расчёт без живых версий остаётся строкой «удалён».
        List<Calculation> all = calculationRepository.findAllByOrderByUpdatedAtDesc();
        Map<UUID, List<Calculation>> byRoot = new LinkedHashMap<>();
        for (Calculation version : all) {
            byRoot.computeIfAbsent(rootIdOf(version), key -> new ArrayList<>()).add(version);
        }

        Map<UUID, CalculationTreeDto> trees = new LinkedHashMap<>();
        byRoot.forEach((rootId, chain) -> trees.put(rootId, toTreeDto(rootId, chain)));
        return trees;
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
        Set<UUID> subtree = subtreeOf(chain, id);

        LocalDateTime now = LocalDateTime.now();
        chain.stream()
                .filter(version -> subtree.contains(version.getId()) && version.getDeletedAt() == null)
                .forEach(version -> version.setDeletedAt(now));
    }

    /**
     * Removes a version and its whole subtree from the database for good.
     *
     * <p>Erasing is the second step after the mark: only a version already
     * marked as deleted may be erased, so the cleanup block can never wipe a
     * live branch by accident. Children are removed by the foreign key cascade
     * of {@code parent_id}.
     *
     * @param id version to erase together with its descendants
     * @throws NotFoundException        if the calculation does not exist
     * @throws IllegalArgumentException if the version is not marked or an order grew from it
     */
    @Transactional
    public void purge(UUID id) {
        purgeAll(List.of(id));
    }

    /**
     * Erases several marked versions with their subtrees.
     *
     * <p>Every identifier must already be marked as deleted: the mark is the
     * confirmation that the branch is not needed any more. A branch that an
     * order grew from is not erased — orders are documents and have to be
     * erased first through the same cleanup block.
     *
     * @param ids versions to erase
     * @return number of erased versions
     * @throws IllegalArgumentException if a version is not marked or has orders
     */
    @Transactional
    public int purgeAll(List<UUID> ids) {
        int erased = 0;
        for (UUID id : ids) {
            Calculation calculation = calculationRepository.findById(id).orElse(null);
            if (calculation == null) {
                continue;
            }
            if (calculation.getDeletedAt() == null) {
                throw new IllegalArgumentException(
                        "Из базы удаляются только помеченные удалёнными версии: «" + calculation.getName()
                                + "» не помечена");
            }

            List<Calculation> chain = calculationRepository
                    .findByRootIdOrderByVersionAsc(rootIdOf(calculation));
            Set<UUID> subtree = subtreeOf(chain, id);

            List<CalculationOrder> orders = orderRepository.findBySourceCalculationIdIn(subtree);
            if (!orders.isEmpty()) {
                String numbers = orders.stream()
                        .map(CalculationOrder::getNumber)
                        .sorted()
                        .collect(Collectors.joining(", "));
                throw new IllegalArgumentException(
                        "Ветку нельзя удалить полностью: из неё создан заказ " + numbers
                                + ". Сначала удалите заказ или оставьте ветку в истории");
            }

            calculationRepository.deleteById(id);
            erased++;
        }
        return erased;
    }

    /**
     * Collects a version and all its descendants inside one tree.
     *
     * @param chain all versions of the tree, ordered by version
     * @param id    version to start from
     * @return identifiers of the version and everything below it
     */
    private Set<UUID> subtreeOf(List<Calculation> chain, UUID id) {
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
        return subtree;
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
     * on. When every version is marked deleted, the newest version still gets
     * returned: the row stays in the history and has to open something.
     *
     * @param chain versions of one tree, oldest first
     * @return identifier of the newest live tip, or of the newest version when
     *         everything is deleted
     */
    private UUID latestIdOf(List<Calculation> chain) {
        Set<UUID> parentsOfLive = new HashSet<>();
        for (Calculation version : chain) {
            if (version.getDeletedAt() == null && version.getParentId() != null) {
                parentsOfLive.add(version.getParentId());
            }
        }
        UUID liveTip = chain.stream()
                .filter(version -> version.getDeletedAt() == null)
                .filter(version -> !parentsOfLive.contains(version.getId()))
                .max(Comparator.comparing(Calculation::getUpdatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(Calculation::getId)
                .orElse(null);
        if (liveTip != null) {
            return liveTip;
        }

        return chain.stream()
                .max(Comparator.comparing(this::versionOf))
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
     * @param orders      orders that grew from this version
     * @return version DTO
     */
    private CalculationVersionDto toVersionDto(Calculation calculation, boolean latest,
                                               List<CalculationVersionOrderDto> orders) {
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
        dto.setClientPrice(clientPriceOf(calculation.getCalculationResult()));
        dto.setQuantity(quantityOf(calculation.getCalculationState()));
        dto.setOrders(orders);
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
        return decimalOf(stored, "totalCost");
    }

    /**
     * Reads the client price (with VAT) out of a stored result snapshot.
     *
     * @param stored JSON snapshot of the result, may be null
     * @return price for the client, or null when the snapshot is missing
     */
    private BigDecimal clientPriceOf(Map<String, Object> stored) {
        return decimalOf(stored, "basePriceWithVAT");
    }

    /**
     * Reads one decimal value out of a stored JSON object.
     *
     * @param stored JSON object, may be null
     * @param key    field name
     * @return decimal value, or null when the field is missing or not a number
     */
    private BigDecimal decimalOf(Map<String, Object> stored, String key) {
        if (stored == null) {
            return null;
        }
        Object value = stored.get(key);
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
     * Reads the print run the price was calculated for.
     *
     * <p>Print mode wins when it is on; assembly takes over otherwise, because
     * only one of the two modes prices the run in the calculator.
     *
     * @param state stored calculation request, may be null
     * @return run size, or null when neither mode is enabled
     */
    private Integer quantityOf(Map<String, Object> state) {
        if (state == null) {
            return null;
        }
        Integer print = quantityOfBlock(state.get("printSettings"));
        return print != null ? print : quantityOfBlock(state.get("assemblySettings"));
    }

    /**
     * Reads the run size out of a print or assembly settings block.
     *
     * @param block settings block, may be null
     * @return run size, or null when the block is off or has no quantity
     */
    private Integer quantityOfBlock(Object block) {
        if (!(block instanceof Map<?, ?> settings)) {
            return null;
        }
        if (!(settings.get("enabled") instanceof Boolean enabled) || !enabled) {
            return null;
        }
        Object quantity = settings.get("quantity");
        return quantity instanceof Number number ? number.intValue() : null;
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
        dto.setDeleted(summary.getLiveCount() != null && summary.getLiveCount() == 0L);
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
        dto.setName(root.getName());
        dto.setManagerName(root.getManagerName());
        dto.setLatestId(latestId);
        dto.setVersion(chain.stream().mapToInt(this::versionOf).max().orElse(1));
        dto.setVersionCount((long) chain.size());
        dto.setDeleted(chain.stream().allMatch(version -> version.getDeletedAt() != null));
        dto.setTotalCost(totalCostOf(latest.getCalculationResult()));
        dto.setClientPrice(clientPriceOf(latest.getCalculationResult()));
        dto.setQuantity(quantityOf(latest.getCalculationState()));
        dto.setUpdatedAt(chain.stream()
                .map(Calculation::getUpdatedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null));
        return dto;
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
}
