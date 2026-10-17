package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Response DTO for the box price calculation endpoint.
 */
@Data
public class CalculationResponse {

    /** Total cost price of the box (rubles, full precision). */
    private BigDecimal totalCost;

    /** Base client price before tier corrections (rubles). */
    private BigDecimal basePrice;

    /** Pricing branch: "×3" or "+N". */
    private String branch;

    /** Base price with VAT for the base tier 10–49 (rubles). */
    private BigDecimal basePriceWithVAT;

    /** Print cost per unit without VAT (rubles). */
    private BigDecimal printCostPerUnit; // стоимость печати на единицу без НДС

    /** Client prices for all 7 quantity tiers. */
    private List<PriceRowDto> prices;
}
