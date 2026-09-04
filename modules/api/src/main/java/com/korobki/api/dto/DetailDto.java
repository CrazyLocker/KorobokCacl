package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

@Data
public class DetailDto {
    private String name;

    /** 0 допустим для отключённых деталей; для включённых проверяется > 0 в сервисе. */
    @NotNull(message = "Detail countOnSheet is required")
    @DecimalMin(value = "0", message = "Detail countOnSheet must be >= 0")
    private BigDecimal countOnSheet;

    @NotNull(message = "Detail sheetPrice is required")
    @DecimalMin(value = "0", message = "Detail sheetPrice must be >= 0")
    private BigDecimal sheetPrice;
    private Boolean isPrinted;
    private Boolean isCustom;
    private Boolean enabled;

    /**
     * Unified map for all operations (standard + custom).
     * Key — operation name, value — enabled/disabled for this detail.
     */
    private Map<String, Boolean> operations;
}
