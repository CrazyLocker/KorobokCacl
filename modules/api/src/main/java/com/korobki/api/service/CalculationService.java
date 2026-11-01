package com.korobki.api.service;

import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service for saving and retrieving calculations.
 *
 * <p>A saved calculation is a version chain: the first save opens the chain
 * ({@code rootId} = own id, {@code version} = 1) and every edit appends a new
 * row with the next version number. History is never overwritten, so an old
 * version can still be opened and recalculated.
 *
 * <p>The request snapshot is stored next to the result snapshot computed at
 * save time: the stored numbers are what the manager saw, while the snapshot
 * of the request lets the view be recalculated later.
 */
@Service
@RequiredArgsConstructor
public class CalculationService {

    private final CalculationRepository calculationRepository;
    private final ObjectMapper objectMapper;
    private final CalculatorService calculatorService;

    /**
     * Saves a new calculation as the first version of a new chain.
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

        Calculation calculation = new Calculation();
        applyMetadata(calculation, request.getName(), request.getClientName(), request.getManagerName());
        calculation.setStatus("draft");
        calculation.setVersion(1);
        calculation.setCalculationState(convertToMap(request.getCalculation()));
        calculation.setCalculationResult(convertToMap(result));

        // root_id = собственный id: первая версия открывает цепочку.
        // Первичный ключ генерируется при вставке, поэтому поле проставляется
        // сразу после save(). Сущность управляемая — UPDATE уходит при коммите.
        Calculation saved = calculationRepository.save(calculation);
        if (saved.getRootId() == null) {
            saved.setRootId(saved.getId());
        }
        return toDto(saved);
    }

    /**
     * Saves an edited calculation as the next version of its chain.
     *
     * <p>The metadata (name, client, manager, status) is inherited from the
     * parent: an iteration changes the calculation itself, not its attribution.
     * The parent version stays untouched.
     *
     * @param id      identifier of any version of the chain
     * @param request edited calculation request
     * @return the saved version
     * @throws NotFoundException        if the calculation does not exist
     * @throws IllegalArgumentException if the calculator rejects the request
     */
    @Transactional
    public CalculationDto iterate(UUID id, CalculationRequest request) {
        Calculation parent = calculationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Расчёт не найден: " + id));

        // Пересчёт до вставки: расчёт, который не считается, не сохраняется.
        CalculationResponse result = calculateOrFail(request);

        Calculation next = new Calculation();
        applyMetadata(next, parent.getName(), parent.getClientName(), parent.getManagerName());
        next.setStatus(parent.getStatus() != null ? parent.getStatus() : "draft");
        next.setRootId(rootIdOf(parent));
        next.setVersion(nextVersion(parent));
        next.setCalculationState(convertToMap(request));
        next.setCalculationResult(convertToMap(result));

        return toDto(calculationRepository.save(next));
    }

    /**
     * Lists the latest version of every calculation, most recently updated first.
     *
     * @return list of saved calculations
     */
    public List<CalculationDto> list() {
        return calculationRepository.findAllHeads().stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Returns a saved calculation by its identifier.
     *
     * @param id calculation identifier
     * @return the calculation
     * @throws IllegalArgumentException if not found
     */
    public CalculationDto get(UUID id) {
        Calculation calculation = calculationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Расчёт не найден: " + id));
        return toDto(calculation);
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
        Calculation calculation = calculationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Расчёт не найден: " + id));

        CalculationViewDto view = new CalculationViewDto();
        view.setId(calculation.getId());
        view.setName(calculation.getName());
        view.setClientName(calculation.getClientName());
        view.setManagerName(calculation.getManagerName());
        view.setStatus(calculation.getStatus());
        view.setVersion(calculation.getVersion());
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
     * Returns the chain identifier of a version.
     *
     * @param calculation any version of the chain
     * @return root identifier; the own id for rows saved before versioning
     */
    private UUID rootIdOf(Calculation calculation) {
        return calculation.getRootId() != null ? calculation.getRootId() : calculation.getId();
    }

    /**
     * Returns the number of the next version of a chain.
     *
     * <p>The latest version is looked up in the database rather than taken from
     * the parent, because an older version can be edited too.
     *
     * @param parent version the iteration starts from
     * @return next free version number
     */
    private int nextVersion(Calculation parent) {
        int parentVersion = parent.getVersion() != null ? parent.getVersion() : 1;
        int headVersion = calculationRepository
                .findTopByRootIdOrderByVersionDesc(rootIdOf(parent))
                .map(head -> head.getVersion() != null ? head.getVersion() : 1)
                .orElse(parentVersion);
        return Math.max(headVersion, parentVersion) + 1;
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
     * Deletes a calculation with its whole version chain.
     *
     * <p>Only the first version is deleted: the foreign key cascades to every
     * later version, so history never outlives the calculation it belongs to.
     *
     * @param id identifier of any version of the chain
     * @throws NotFoundException if the calculation does not exist
     */
    @Transactional
    public void delete(UUID id) {
        Calculation calculation = calculationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Расчёт не найден: " + id));
        calculationRepository.deleteById(rootIdOf(calculation));
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
     * Maps a calculation entity to its DTO.
     *
     * @param calculation entity to map
     * @return calculation DTO
     */
    private CalculationDto toDto(Calculation calculation) {
        CalculationDto dto = new CalculationDto();
        dto.setId(calculation.getId());
        dto.setRootId(calculation.getRootId());
        dto.setVersion(calculation.getVersion());
        dto.setName(calculation.getName());
        dto.setClientName(calculation.getClientName());
        dto.setManagerName(calculation.getManagerName());
        dto.setStatus(calculation.getStatus());
        dto.setCalculation(calculation.getCalculationState());
        dto.setCreatedAt(calculation.getCreatedAt());
        dto.setUpdatedAt(calculation.getUpdatedAt());
        return dto;
    }
}
