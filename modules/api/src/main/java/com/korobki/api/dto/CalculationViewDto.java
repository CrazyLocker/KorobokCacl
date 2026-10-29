package com.korobki.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Read-only view of a saved calculation: metadata, the stored request parsed
 * back into a normalised DTO and the result of recomputing it.
 *
 * <p>Unlike {@link CalculationDto}, which returns the raw JSON snapshot, this
 * DTO is typed. The result is computed on the fly from the stored state, so
 * it may differ from the numbers the manager saw when saving if the price
 * references (print tables) changed in the meantime.
 */
@Data
public class CalculationViewDto {

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

    /** Creation timestamp. */
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    private LocalDateTime updatedAt;

    /** Stored request parsed from JSON; null when the state cannot be read. */
    private CalculationRequest request;

    /** Recomputed result; null when the state is unreadable or invalid. */
    private CalculationResponse result;

    /** Human-readable reason when {@link #request} or {@link #result} is null. */
    private String viewError;
}
