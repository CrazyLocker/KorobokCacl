package com.korobki.api.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class ExtraDto {
    private String name;
    private BigDecimal cost;
    private Boolean enabled;
    private Boolean isCustom;
}
