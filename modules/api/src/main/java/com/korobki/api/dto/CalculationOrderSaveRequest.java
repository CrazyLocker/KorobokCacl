package com.korobki.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

/** Request DTO for creating or editing a client order. */
@Data
public class CalculationOrderSaveRequest {

    /**
     * Version the order grows from. The client of the order is the client of
     * that version, so no separate client field is needed.
     */
    @NotNull(message = "Укажите версию расчёта, из которой создаётся заказ")
    private UUID sourceCalculationId;

    /** Order number, unique per client; generated when blank. */
    @Size(max = 50, message = "Номер заказа — не длиннее 50 символов")
    private String number;

    /** Date the order was placed; today when omitted. */
    private LocalDate orderDate;

    /** Lifecycle status; draft when omitted. */
    private String status;

    /** Free-form note about the deal. */
    @Size(max = 500, message = "Комментарий — не длиннее 500 символов")
    private String comment;
}
