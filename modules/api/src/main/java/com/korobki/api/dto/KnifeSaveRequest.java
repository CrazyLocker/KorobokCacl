package com.korobki.api.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/** Request to save a knife calculation result. */
@Data
public class KnifeSaveRequest {

    /** Human-readable knife name. */
    @NotBlank(message = "Укажите название ножа")
    private String name;

    /** SVG markup of the knife layout. */
    @NotBlank(message = "Загрузите SVG-файл")
    private String svgContent;

    /** Total cutting length in millimeters. */
    @NotNull(message = "Укажите общую длину")
    @Positive(message = "Общая длина должна быть больше 0")
    private BigDecimal totalLengthMm;

    /** Computed knife cost (rubles). */
    @NotNull(message = "Укажите стоимость ножа")
    @Positive(message = "Стоимость ножа должна быть больше 0")
    private BigDecimal knifeCost;

    /** Client the knife was made for. */
    @NotBlank(message = "Укажите клиента")
    private String clientName;

    /** Manager who saved the knife. */
    @NotBlank(message = "Укажите менеджера")
    private String managerName;
}
