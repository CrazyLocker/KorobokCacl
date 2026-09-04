package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class CalculationRequest {
    @NotBlank(message = "Construction name is required")
    private String construction;

    @NotEmpty(message = "At least one detail is required")
    @Valid
    private List<DetailDto> details;

    private List<@Valid ExtraDto> extras;

    private PrintSettingsDto printSettings;

    @NotNull(message = "Work price is required")
    @DecimalMin(value = "0.0", message = "Work price must be >= 0")
    private BigDecimal workPrice;

    /** Плечо (margin) — надбавка для ветки "+N". Если null, берётся из конфига (30). */
    @DecimalMin(value = "0.0", message = "Margin value must be >= 0")
    private BigDecimal marginValue;

    private Map<String, BigDecimal> priceList;
}
