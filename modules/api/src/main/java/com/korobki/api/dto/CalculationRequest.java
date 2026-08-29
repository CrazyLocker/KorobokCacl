package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class CalculationRequest {
    private String construction;
    private List<DetailDto> details;
    private List<ExtraDto> extras; // All operations (standard + custom) in a single list
    private PrintSettingsDto printSettings;
    private BigDecimal workPrice;
    private Map<String, BigDecimal> priceList;
}
