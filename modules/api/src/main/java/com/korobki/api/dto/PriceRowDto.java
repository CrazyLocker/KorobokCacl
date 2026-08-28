package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class PriceRowDto {
    private String label;
    private BigDecimal withoutVAT;
    private Integer calculatedPrice;
    private Integer priceListPrice;
    private Integer finalPrice;
    private Boolean isBase;
    private Boolean isPriceListUsed;
}
