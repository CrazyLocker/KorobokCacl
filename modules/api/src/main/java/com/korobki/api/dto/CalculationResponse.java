package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CalculationResponse {
    private BigDecimal totalCost;
    private BigDecimal basePrice;
    private String branch;
    private BigDecimal basePriceWithVAT;
    private BigDecimal printCostPerUnit; // стоимость печати на единицу без НДС
    private List<PriceRowDto> prices;
}
