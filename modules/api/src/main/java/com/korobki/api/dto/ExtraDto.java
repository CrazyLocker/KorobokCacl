package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * DTO for an additional operation in the calculation request.
 */
@Data
public class ExtraDto {

    /** Operation name, e.g. "Тиснение". */
    @NotBlank(message = "Operation name is required")
    @Size(max = 50, message = "Operation name must be <= 50 characters")
    private String name;

    /** Cost per detail (rubles). */
    @NotNull(message = "Operation cost is required")
    @DecimalMin(value = "0.0", message = "Operation cost must be >= 0")
    private BigDecimal cost;

    /** Whether the operation is available. */
    private Boolean enabled;

    /** Whether the operation was added by the user (not from the reference). */
    private Boolean isCustom;
}
