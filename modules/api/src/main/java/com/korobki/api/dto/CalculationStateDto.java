package com.korobki.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
public class CalculationStateDto {
    private UUID id;
    private String name;
    private Map<String, Object> calculation;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
