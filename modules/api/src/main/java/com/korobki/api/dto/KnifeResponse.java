package com.korobki.api.dto;

import lombok.Data;

import java.util.List;

/**
 * Response DTO for the knife calculation endpoint.
 */
@Data
public class KnifeResponse {

    /** Total cutting length in SVG units (pixels). */
    private double totalLengthPx;

    /** Total cutting length in millimeters. */
    private double totalLengthMm;

    /** Computed knife cost (rubles). */
    private double knifeCost;

    /** Scale factor (mm per SVG unit) used for the conversion. */
    private double scale;

    /** Per-element length breakdown. */
    private List<KnifeElement> details;

    /** Length of a single SVG element. */
    @Data
    public static class KnifeElement {

        /** SVG element type: line, rect, path, polyline, circle, ellipse. */
        private String type;

        /** Element length in SVG units (pixels). */
        private double lengthPx;

        /** Element length in millimeters. */
        private double lengthMm;
    }
}
