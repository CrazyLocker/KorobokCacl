package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Data
public class CalculationSaveRequest {
    @NotBlank(message = "Calculation name is required")
    private String name;

    @NotBlank(message = "Client name is required")
    private String clientName;

    @NotBlank(message = "Manager name is required")
    private String managerName;

    @Valid
    @NotNull(message = "Calculation data is required")
    private CalculationRequest calculation;
}
