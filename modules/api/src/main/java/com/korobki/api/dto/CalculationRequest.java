package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CalculationRequest {
    private String construction;
    private List<DetailDto> details;
    private List<ExtraDto> extras;
    private List<ExtraDto> customExtras;
    private PrintSettingsDto printSettings;
    private BigDecimal workPrice;
    private java.util.Map<String, BigDecimal> priceList;
}
