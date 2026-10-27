package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/**
 * DTO for a single box detail (part) in the calculation request.
 */
@Data
public class DetailDto {

    /** Detail name, e.g. "Дно", "Крышка". */
    private String name;

    /** 0 допустим для отключённых деталей; для включённых проверяется > 0 в сервисе. */
    @NotNull(message = "Detail countOnSheet is required")
    @DecimalMin(value = "0", message = "Detail countOnSheet must be >= 0")
    private BigDecimal countOnSheet;

    /** Material price per sheet (rubles). */
    @NotNull(message = "Detail sheetPrice is required")
    @DecimalMin(value = "0", message = "Detail sheetPrice must be >= 0")
    private BigDecimal sheetPrice;

    /** Whether print cost is applied to this detail. */
    private Boolean isPrinted;

    /**
     * Number of identical details printed on one print sheet.
     * Used by the prototype print formula; null or 0 is treated as 1.
     */
    private Integer partsPerSheetOnPrint;

    /**
     * Whether the detail is placed on the assembly sheet
     * ("Сборка на печатный лист"). Null/false = the detail is not printed.
     */
    private Boolean inAssembly;

    /**
     * How many copies of this detail fit on the assembly sheet;
     * null or 0 is treated as 1.
     */
    private Integer partsPerSheetInAssembly;

    /** Whether the detail was added by the user (not from the construction). */
    private Boolean isCustom;

    /** Whether the detail participates in the calculation. */
    private Boolean enabled;

    /**
     * Unified map for all operations (standard + custom).
     * Key — operation name, value — enabled/disabled for this detail.
     */
    private Map<String, Boolean> operations;
}
