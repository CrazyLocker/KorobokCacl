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

    /** Identifier of the first version in the chain. */
    private UUID rootId;

    /** Version number inside the branch, starting at 1. */
    private Integer version;

    /** Version this one was made from; null for the tree root. */
    private UUID parentId;

    /** Identifier of the newest tip of the tree; null when the tree has no live versions. */
    private UUID latestId;

    /** Number of live versions in the tree. */
    private Long versionCount;

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
