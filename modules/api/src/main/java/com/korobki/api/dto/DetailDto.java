package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;

@Data
public class DetailDto {
    private String name;
    private BigDecimal countOnSheet;
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
