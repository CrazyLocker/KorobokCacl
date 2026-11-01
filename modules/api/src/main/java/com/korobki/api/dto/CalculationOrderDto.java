package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Client order: a deal that grows from one calculation version.
 *
 * <p>The client picked a variant, so the order points at that version. The rest
 * of the versions stay in the calculation tree untouched.
 */
@Data
public class CalculationOrderDto {

    /** Order identifier. */
    private UUID id;

    /** Client the order belongs to. */
    private UUID customerId;

    /** Client name, denormalised for tables. */
    private String customerName;

    /** Order number, unique per client. */
    private String number;

    /** Date the order was placed. */
    private LocalDate orderDate;

    /** Lifecycle status: draft, ready, sent, in_work, closed. */
    private String status;

    /** Free-form note about the deal. */
    private String comment;

    /** Version the order grew from. */
    private UUID sourceCalculationId;

    /** Number of the source version, e.g. 3 for v3. */
    private Integer sourceVersion;

    /** Calculation name at the source version. */
    private String sourceCalculationName;

    /** Last modification of the source version. */
    private LocalDateTime sourceCalculationUpdatedAt;

    /** Newest tip of the source tree, used by "Редактировать". */
    private UUID sourceCalculationLatestId;

    /** Cost of the source version; null when it has no stored snapshot. */
    private BigDecimal totalCost;

    /** Creation timestamp. */
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    private LocalDateTime updatedAt;
}
