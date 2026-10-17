package com.korobki.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/** Saved box calculation (list/restore view). */
@Data
public class CalculationDto {

    /** Calculation identifier. */
    private UUID id;

    /** Human-readable calculation name. */
    private String name;

    /** Client the calculation was made for. */
    private String clientName;

    /** Manager who created the calculation. */
    private String managerName;

    /** Lifecycle status: draft, ready, sent, in_work, closed. */
    private String status;

    /** Stored calculation request snapshot. */
    private Map<String, Object> calculation;

    /** Creation timestamp. */
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    private LocalDateTime updatedAt;
}
