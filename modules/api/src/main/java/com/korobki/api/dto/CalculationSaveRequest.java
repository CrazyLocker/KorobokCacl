package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request DTO for saving a calculation.
 */
@Data
public class CalculationSaveRequest {

    /** Human-readable calculation name. */
    @NotBlank(message = "Calculation name is required")
    private String name;

    /** Client the calculation was made for. */
    @NotBlank(message = "Client name is required")
    private String clientName;

    /** Manager who created the calculation. */
    @NotBlank(message = "Manager name is required")
    private String managerName;

    /** Full calculation request snapshot to store. */
    @Valid
    @NotNull(message = "Calculation data is required")
    private CalculationRequest calculation;
}
