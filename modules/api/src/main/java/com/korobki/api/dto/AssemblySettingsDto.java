package com.korobki.api.dto;

import lombok.Data;

/**
 * DTO for the "Сборка на печатный лист" (sheet assembly) mode.
 *
 * <p>One print sheet carries a set of details, and one box is one complete set,
 * so the box run equals the run of each detail. Mutually exclusive with
 * single-detail print mode ({@link PrintSettingsDto#getEnabled()} and
 * {@link DetailDto#getIsPrinted()}).
 */
@Data
public class AssemblySettingsDto {

    /** Whether assembly mode is on. */
    private Boolean enabled;

    /** Print format identifier (references print_tables.format_id). */
    private Integer format;

    /** Box run: one box is one complete set of details. */
    private Integer boxQuantity;
}
