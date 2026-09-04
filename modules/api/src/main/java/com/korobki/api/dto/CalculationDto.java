package com.korobki.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/** Saved box calculation (list/restore view). */
@Data
public class CalculationDto {
    private UUID id;
    private String name;
    private String clientName;
    private String managerName;
    private String status;
    private Map<String, Object> calculation;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
