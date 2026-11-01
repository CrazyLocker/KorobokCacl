package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Client order (a deal that groups calculations). */
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

    /** Number of live calculations in the order. */
    private Long calculationCount;

    /** Sum of the newest version cost of every calculation, null when empty. */
    private BigDecimal totalCost;

    /** Creation timestamp. */
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    private LocalDateTime updatedAt;
}
