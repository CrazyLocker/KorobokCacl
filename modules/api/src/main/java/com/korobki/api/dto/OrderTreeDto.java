package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Order node of the customer → order tree.
 *
 * <p>An order grows from one calculation version: the client picked that
 * variant, and the rest of the versions stay in the tree untouched.
 */
@Data
public class OrderTreeDto {

    /** Order identifier. */
    private UUID id;

    /** Client the order belongs to. */
    private UUID customerId;

    /** Order number. */
    private String number;

    /** Date the order was placed. */
    private LocalDate orderDate;

    /** Lifecycle status. */
    private String status;

    /** Cost of the version the order grew from. */
    private BigDecimal totalCost;

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

    /** True when the order is marked as deleted: the tree shows it struck through. */
    private Boolean deleted;
}
