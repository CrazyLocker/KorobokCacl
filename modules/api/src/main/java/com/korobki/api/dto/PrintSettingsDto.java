package com.korobki.api.dto;

import lombok.Data;

@Data
public class PrintSettingsDto {
    private Boolean enabled;
    private Integer format;
    private Integer quantity;
}
