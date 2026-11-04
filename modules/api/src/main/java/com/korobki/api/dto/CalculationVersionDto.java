package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One version of a saved calculation.
 *
 * <p>Lightweight history entry: it carries the numbers needed to pick the
 * version in the UI, while the full state is fetched through the view
 * endpoint of the version id.
 */
@Data
public class CalculationVersionDto {

    /** Version identifier; the version is opened by this id. */
    private UUID id;

    /** Version number inside the branch, starting at 1. */
    private Integer version;

    /** Version this one was branched from; null for the root of the tree. */
    private UUID parentId;

    /** True when the version is marked deleted but kept in the history. */
    private boolean deleted;

    /** Calculation name at that version. */
    private String name;

    /** Client the calculation was made for. */
    private String clientName;

    /** Manager who saved the version. */
    private String managerName;

    /** Lifecycle status at that version. */
    private String status;

    /** Total cost stored with the version; null for versions saved before snapshots. */
    private BigDecimal totalCost;

    /** Price for the client (with VAT) stored with the version; null without a snapshot. */
    private BigDecimal clientPrice;

    /** Print run the client price was calculated for; null when neither mode is enabled. */
    private Integer quantity;

    /** Orders that grew from this version; empty when none were placed from it. */
    private List<CalculationVersionOrderDto> orders = new ArrayList<>();

    /** True for the latest version of the chain. */
    private boolean latest;

    /** Creation timestamp. */
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    private LocalDateTime updatedAt;
}
