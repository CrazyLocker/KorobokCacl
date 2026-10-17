package com.korobki.api.dto;

import lombok.Data;

/**
 * DTO for print settings in the calculation request.
 */
@Data
public class PrintSettingsDto {

    /** Whether printing is enabled. */
    private Boolean enabled;

    /** Print format identifier (references print_tables.format_id). */
    private Integer format;

    /** Print quantity (units). */
    private Integer quantity;
}
