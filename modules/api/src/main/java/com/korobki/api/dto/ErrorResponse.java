package com.korobki.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Structured error payload returned by the global exception handler.
 */
@Data
@AllArgsConstructor
public class ErrorResponse {

    /** HTTP status code. */
    private int status;

    /** General error message. */
    private String message;

    /** Per-field error details (field name → message). */
    private Map<String, String> errors;

    /** Time the error occurred. */
    private LocalDateTime timestamp;
}
