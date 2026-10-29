package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * Assembly mode: how one detail took part in the shared print run.
 *
 * <p>The print bill of an assembly sheet is shared by every copy on it, so
 * {@code perPart} is the same for all details in the run. It is returned per
 * detail so the UI does not have to duplicate the sheet/tariff formula.
 */
@Data
public class DetailCostDto {

    /** Zero-based index of the detail in the request {@code details} list. */
    private Integer detailId;

    /** Print cost of one copy of this detail without VAT (rubles). */
    private BigDecimal perPart;

    /** Whether the detail is placed on the assembly sheet. */
    private Boolean inAssembly;

    /** Copies of this detail on one assembly sheet (null was treated as 1). */
    private Integer colsOnSheet;

    /** Sheets printed for the run; 0 when the detail is not printed. */
    private Integer sheets;

    /**
     * Whether the detail cannot be printed: it is marked for assembly but the
     * run has no price (for example, the print table for the format is missing).
     */
    private Boolean printBlocked;
}
