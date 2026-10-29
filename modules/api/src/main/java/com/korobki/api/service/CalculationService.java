package com.korobki.api.service;

import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service for saving and retrieving calculations.
 * Stores the full calculation request as a JSON snapshot.
 */
@Service
@RequiredArgsConstructor
public class CalculationService {

    private final CalculationRepository calculationRepository;
    private final ObjectMapper objectMapper;
    private final CalculatorService calculatorService;

    /**
     * Saves a new calculation with status "draft".
     *
     * @param request calculation data (name, client, manager, state)
     * @return the saved calculation
     */
    @Transactional
    public CalculationDto save(CalculationSaveRequest request) {
        Calculation calculation = new Calculation();
        calculation.setName(request.getName());
        calculation.setClientName(request.getClientName());
        calculation.setManagerName(request.getManagerName());
        calculation.setStatus("draft");
        calculation.setCalculationState(convertToMap(request.getCalculation()));

        Calculation saved = calculationRepository.save(calculation);
        return toDto(saved);
    }

    /**
     * Lists all saved calculations, newest first.
     *
     * @return list of saved calculations
     */
    public List<CalculationDto> list() {
        return calculationRepository.findAllByOrderByCreatedAtDesc().stream()
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
                .orElseThrow(() -> new IllegalArgumentException("Calculation not found: " + id));
        return toDto(calculation);
    }

    /**
     * Builds a read-only view of a saved calculation: metadata, the stored
     * request and the result recomputed from it.
     *
     * <p>The stored state is the request snapshot saved earlier, so it is
     * parsed back into {@link CalculationRequest}. Broken or incomplete state
     * does not fail the request: the view is returned with {@code viewError}
     * filled in and {@code result} left null.
     *
     * @param id calculation identifier
     * @return read-only calculation view
     * @throws NotFoundException if the calculation does not exist
     */
    @Transactional(readOnly = true)
    public CalculationViewDto view(UUID id) {
        Calculation calculation = calculationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Calculation not found: " + id));

        CalculationViewDto view = new CalculationViewDto();
        view.setId(calculation.getId());
        view.setName(calculation.getName());
        view.setClientName(calculation.getClientName());
        view.setManagerName(calculation.getManagerName());
        view.setStatus(calculation.getStatus());
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
        view.setRequest(request);

        String incomplete = findIncomplete(request);
        if (incomplete != null) {
            view.setViewError("Не удалось пересчитать: " + incomplete);
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
     * Deletes a saved calculation.
     *
     * @param id calculation identifier
     */
    @Transactional
    public void delete(UUID id) {
        calculationRepository.deleteById(id);
    }

    /**
     * Converts an arbitrary request object into a JSON-friendly map.
     *
     * @param request object to convert
     * @return map representation
     */
    private Map<String, Object> convertToMap(Object request) {
        return objectMapper.convertValue(request, Map.class);
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
