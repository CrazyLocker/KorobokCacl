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

    /**
     * Источник масштаба (как в прототипе): 'width/height атрибуты', 'viewBox как мм',
     * 'default 100×100 px', 'default (px→mm)'.
     */
    private String scaleSource;

    /** Единица измерения корня документа: mm, cm, in, pt, pc, px. */
    private String unit;

    /**
     * Описание ошибки разбора SVG ({@code null} — разбор прошёл успешно).
     * Если поле не {@code null}, HTTP-статус остаётся 200, но длины нулевые и
     * фронт должен показать ошибку вместо «0.00 мм». Ненулевые длины при этом
     * невозможны: расчёт не выполнялся.
     */
    private String parseError;

    /**
     * Per-element length breakdown с флагом transform.
     * Используйте это поле; {@link #details} оставлено для обратной совместимости.
     */
    private List<KnifeElementDto> elements;

    /**
     * Per-element length breakdown без флага transform.
     * Оставлено для обратной совместимости — используйте {@link #elements}.
     */
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
