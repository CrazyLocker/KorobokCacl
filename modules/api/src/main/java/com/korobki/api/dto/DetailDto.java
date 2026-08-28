package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class DetailDto {
    private String name;
    private BigDecimal countOnSheet;
    private BigDecimal sheetPrice;
    private Boolean isPrinted;
    private Boolean isCustom;
    private Boolean enabled;
    private Boolean hasLak;
    private Boolean hasCongrev;
    private Boolean hasTisnenie;
}
