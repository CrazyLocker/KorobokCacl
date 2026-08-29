package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@Data
public class ExtraDto {
    @NotBlank(message = "Operation name is required")
    @Size(max = 50, message = "Operation name must be <= 50 characters")
    private String name;

    @NotNull(message = "Operation cost is required")
    @DecimalMin(value = "0.0", message = "Operation cost must be >= 0")
    private BigDecimal cost;

    private Boolean enabled;
    private Boolean isCustom;
}
