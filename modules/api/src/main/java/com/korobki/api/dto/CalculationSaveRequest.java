package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Request DTO for saving a calculation.
 */
@Data
public class CalculationSaveRequest {

    /** Human-readable calculation name. */
    @NotBlank(message = "Укажите название расчёта")
    private String name;

    /**
     * Client of the reference book. When omitted, {@link #clientName} is used
     * and the client is looked up (or created) by that name.
     */
    private UUID customerId;

    /**
     * Client name of the legacy API contract; kept so older clients keep
     * working. Ignored when {@link #customerId} is set.
     */
    private String clientName;

    /** Order the calculation belongs to; null means "no order yet". */
    private UUID orderId;

    /** Manager who created the calculation. */
    @NotBlank(message = "Укажите менеджера")
    private String managerName;

    /** Full calculation request snapshot to store. */
    @Valid
    @NotNull(message = "Нет данных расчёта")
    private CalculationRequest calculation;
}
