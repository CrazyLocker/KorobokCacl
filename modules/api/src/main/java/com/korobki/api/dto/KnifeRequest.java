package com.korobki.api.dto;

import lombok.Data;

import java.util.List;

/**
 * Request DTO for the knife calculation endpoint.
 */
@Data
public class KnifeRequest {

    /** SVG-текст — SVG markup of the knife layout. */
    private String svgContent; // SVG-текст
}
