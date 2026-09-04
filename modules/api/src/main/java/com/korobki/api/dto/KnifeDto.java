package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Saved knife (list view). */
@Data
public class KnifeDto {
    private UUID id;
    private String name;
    private BigDecimal totalLengthMm;
    private BigDecimal knifeCost;
    private String clientName;
    private String managerName;
    private LocalDateTime createdAt;
}
