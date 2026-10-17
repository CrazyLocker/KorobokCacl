package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * DTO for a single price tier row in the calculation response.
 */
@Data
public class PriceRowDto {

    /** Tier label, e.g. "10–49". */
    private String label;

    /** Price without VAT (display, 2 decimals). */
    private BigDecimal withoutVAT;

    /** Calculated price with VAT (rubles). */
    private Integer calculatedPrice;

    /** User-defined price list value (0 = not set). */
    private Integer priceListPrice;

    /** Final client price: price list value if it exceeds the calculated price. */
    private Integer finalPrice;

    /** Whether this tier is the base tier (10–49). */
    private Boolean isBase;

    /** Whether the price list value was used for the final price. */
    private Boolean isPriceListUsed;
}
