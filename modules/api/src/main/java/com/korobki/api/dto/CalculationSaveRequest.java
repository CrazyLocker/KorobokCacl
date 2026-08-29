package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Data
public class CalculationSaveRequest {
    @NotBlank(message = "Session ID is required")
    private String sessionId;

    @NotBlank(message = "Calculation name is required")
    private String name;

    @Valid
    @NotNull(message = "Calculation data is required")
    private CalculationRequest calculation;
}
