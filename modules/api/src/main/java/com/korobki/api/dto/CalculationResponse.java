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

    /**
     * Assembly mode: print cost of one copy of any detail on the sheet
     * without VAT (rubles) — {@code (bill / sheets) / totalPartsOnSheet}.
     * Null when the mode is off.
     *
     * @deprecated the same value is returned per detail in {@link #details};
     *             kept for backward compatibility.
     */
    @Deprecated
    private BigDecimal assemblyCostPerPart;

    /**
     * Assembly mode: cost of one printed sheet without VAT (rubles) —
     * {@code bill / sheets}. Null when the mode is off.
     *
     * @deprecated use {@link #details} or {@link #assemblyCostPerPart};
     *             kept for backward compatibility.
     */
    @Deprecated
    private BigDecimal assemblySheetCost;

    /**
     * Assembly mode: number of sheets printed for the run
     * ({@code max(ceil(quantity / colsOnSheet))}). Null when the mode is off.
     *
     * @deprecated the same value is returned per detail in {@link #details};
     *             kept for backward compatibility.
     */
    @Deprecated
    private Integer assemblySheets;

    /**
     * Assembly mode: sum of copies-per-sheet of all details on the sheet.
     * Null when the mode is off.
     *
     * @deprecated use {@link #details}; kept for backward compatibility.
     */
    @Deprecated
    private Integer assemblyPartsOnSheet;

    /**
     * Assembly mode: print part of each request detail, in request order.
     * Null when the mode is off.
     */
    private List<DetailCostDto> details;

    /** Client prices for all 7 quantity tiers. */
    private List<PriceRowDto> prices;
}
