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
    @NotBlank(message = "Укажите название операции")
    @Size(max = 50, message = "Название операции — не длиннее 50 символов")
    private String name;

    /** Cost per detail (rubles). */
    @NotNull(message = "Укажите стоимость операции")
    @DecimalMin(value = "0.0", message = "Стоимость операции не может быть отрицательной")
    private BigDecimal cost;

    /** Whether the operation is available. */
    private Boolean enabled;

    /** Whether the operation was added by the user (not from the reference). */
    private Boolean isCustom;
}
