package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** One calculation tree inside the customer → order → calculation tree. */
@Data
public class CalculationTreeDto {

    /** Identifier of the tree root (the first version). */
    private UUID id;

    /** Client the calculation belongs to. */
    private UUID customerId;

    /** Order the calculation belongs to; null when it has no order yet. */
    private UUID orderId;

    /** Human-readable calculation name. */
    private String name;

    /** Manager who created the calculation. */
    private String managerName;

    /** Identifier of the newest live tip, used by "Редактировать". */
    private UUID latestId;

    /** Deepest version number in the tree. */
    private Integer version;

    /** Number of live versions in the tree. */
    private Long versionCount;

    /** Cost of the newest version; null when it has no stored snapshot. */
    private BigDecimal totalCost;

    /** Last modification timestamp of the tree. */
    private LocalDateTime updatedAt;
}
