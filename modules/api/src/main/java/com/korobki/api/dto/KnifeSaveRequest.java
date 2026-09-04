package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/** Request to save a knife calculation result. */
@Data
public class KnifeSaveRequest {
    @NotBlank(message = "Knife name is required")
    private String name;

    @NotBlank(message = "SVG content is required")
    private String svgContent;

    @NotNull(message = "Total length is required")
    @Positive(message = "Total length must be > 0")
    private BigDecimal totalLengthMm;

    @NotNull(message = "Knife cost is required")
    @Positive(message = "Knife cost must be > 0")
    private BigDecimal knifeCost;

    @NotBlank(message = "Client name is required")
    private String clientName;

    @NotBlank(message = "Manager name is required")
    private String managerName;
}
