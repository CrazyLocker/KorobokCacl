package com.korobki.api.service;

import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CalculationService {

    private final CalculationRepository calculationRepository;
    private final ObjectMapper objectMapper;

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

    public List<CalculationDto> list() {
        return calculationRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    public CalculationDto get(UUID id) {
        Calculation calculation = calculationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Calculation not found: " + id));
        return toDto(calculation);
    }

    @Transactional
    public void delete(UUID id) {
        calculationRepository.deleteById(id);
    }

    private Map<String, Object> convertToMap(Object request) {
        return objectMapper.convertValue(request, Map.class);
    }

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
