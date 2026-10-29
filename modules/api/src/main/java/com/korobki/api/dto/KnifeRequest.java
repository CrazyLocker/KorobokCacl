package com.korobki.api.dto;

import lombok.Data;

/**
 * Request DTO for the knife calculation endpoint.
 */
@Data
public class KnifeRequest {

    /** SVG-текст — SVG markup of the knife layout. */
    private String svgContent; // SVG-текст

    /**
     * Учитывать transform, включая вложенные {@code <g>} (как чекбокс прототипа).
     * {@code null} трактуется как {@code true} — обратная совместимость со старыми клиентами.
     */
    private Boolean useTransform = Boolean.TRUE;

    /**
     * Учитывать единицы измерения (mm/cm/in/pt/pc/px) в width/height и в атрибутах элементов.
     * {@code null} трактуется как {@code true}.
     */
    private Boolean useUnits = Boolean.TRUE;
}
