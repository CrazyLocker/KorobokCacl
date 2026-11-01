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
    @NotBlank(message = "Укажите название расчёта")
    private String name;

    /** Client the calculation was made for. */
    @NotBlank(message = "Укажите клиента")
    private String clientName;

    /** Manager who created the calculation. */
    @NotBlank(message = "Укажите менеджера")
    private String managerName;

    /** Full calculation request snapshot to store. */
    @Valid
    @NotNull(message = "Нет данных расчёта")
    private CalculationRequest calculation;
}
