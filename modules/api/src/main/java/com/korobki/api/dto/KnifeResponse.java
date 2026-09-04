package com.korobki.api.dto;

import lombok.Data;

import java.util.List;

@Data
public class KnifeResponse {
    private double totalLengthPx;
    private double totalLengthMm;
    private double knifeCost;
    private double scale;
    private List<KnifeElement> details;

    @Data
    public static class KnifeElement {
        private String type;
        private double lengthPx;
        private double lengthMm;
    }
}
