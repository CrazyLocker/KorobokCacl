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

/**
 * Request DTO for the box price calculation endpoint.
 */
@Data
public class CalculationRequest {

    /** Construction (box type) name. */
    @NotBlank(message = "Укажите конструкцию")
    private String construction;

    /** Box details with layout parameters. */
    @NotEmpty(message = "Нужна хотя бы одна деталь")
    @Valid
    private List<DetailDto> details;

    /** Additional operations (standard + custom). */
    private List<@Valid ExtraDto> extras;

    /** Print settings; null or disabled = no print. */
    private PrintSettingsDto printSettings;

    /**
     * «Сборка на печатный лист»; null or disabled = the mode is off.
     * Mutually exclusive with single-detail print ({@code printSettings.enabled}).
     */
    private AssemblySettingsDto assemblySettings;

    /** Work price per detail (rubles). */
    @NotNull(message = "Укажите стоимость работы")
    @DecimalMin(value = "0.0", message = "Стоимость работы не может быть отрицательной")
    private BigDecimal workPrice;

    /** Плечо (margin) — надбавка для ветки "+N". Если null, берётся из конфига (30). */
    @DecimalMin(value = "0.0", message = "Наценка не может быть отрицательной")
    private BigDecimal marginValue;

    /** User-defined price list: tier label → price (0 = not set). */
    private Map<String, BigDecimal> priceList;
}
