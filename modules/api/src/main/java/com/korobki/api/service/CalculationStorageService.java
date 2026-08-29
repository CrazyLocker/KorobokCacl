package com.korobki.api.service;

import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationStateDto;
import com.korobki.persistence.entity.Order;
import com.korobki.persistence.repository.OrderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalculationStorageService {

    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    public CalculationStateDto saveCalculation(CalculationSaveRequest request) {
        Order order = new Order();
        order.setClientName(request.getName());
        order.setStatus("draft");
        order.setCalculationState(convertToMap(request.getCalculation()));
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());

        Order saved = orderRepository.save(order);
        return convertToDto(saved);
    }

    public List<CalculationStateDto> getCalculations(String sessionId) {
        return orderRepository.findAll().stream()
                .filter(o -> o.getClientName() != null && o.getClientName().equals(sessionId))
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public CalculationStateDto getCalculation(UUID id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Calculation not found"));
        return convertToDto(order);
    }

    public void deleteCalculation(UUID id) {
        orderRepository.deleteById(id);
    }

    private Map<String, Object> convertToMap(CalculationRequest request) {
        return objectMapper.convertValue(request, Map.class);
    }

    private CalculationStateDto convertToDto(Order order) {
        CalculationStateDto dto = new CalculationStateDto();
        dto.setId(order.getId());
        dto.setName(order.getClientName());
        dto.setCalculation(order.getCalculationState());
        dto.setCreatedAt(order.getCreatedAt());
        dto.setUpdatedAt(order.getUpdatedAt());
        return dto;
    }
}
