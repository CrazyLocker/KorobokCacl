package com.korobki.api.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

/**
 * DTO for the "Сборка на печатный лист" (sheet assembly) mode.
 *
 * <p>One print sheet carries a set of details, and one box is one complete set,
 * so the run of each detail equals the requested quantity. Mutually exclusive
 * with single-detail print mode ({@link PrintSettingsDto#getEnabled()} and
 * {@link DetailDto#getIsPrinted()}).
 */
@Data
public class AssemblySettingsDto {

    /** Whether assembly mode is on. */
    private Boolean enabled;

    /** Print format identifier (references print_tables.format_id). */
    private Integer format;

    /**
     * Run of each detail on the assembly sheet (number of complete sets).
     *
     * <p>The old name {@code boxQuantity} is accepted as an alias so
     * calculations saved before the assembly model was reworked still load.
     */
    @JsonAlias("boxQuantity")
    private Integer quantity;
}
