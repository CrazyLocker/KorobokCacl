package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Saved knife (list view). */
@Data
public class KnifeDto {

    /** Knife identifier. */
    private UUID id;

    /** Human-readable knife name. */
    private String name;

    /** Total cutting length in millimeters. */
    private BigDecimal totalLengthMm;

    /** Computed knife cost (rubles). */
    private BigDecimal knifeCost;

    /** Client the knife was made for. */
    private String clientName;

    /** Manager who saved the knife. */
    private String managerName;

    /** Creation timestamp. */
    private LocalDateTime createdAt;
}
