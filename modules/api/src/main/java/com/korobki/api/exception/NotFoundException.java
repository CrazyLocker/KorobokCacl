package com.korobki.api.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Missing entity (HTTP 404).
 *
 * <p>{@link GlobalExceptionHandler} maps it explicitly to a structured
 * {@code ErrorResponse}; {@code @ResponseStatus} is a safety net for the case
 * when the handler is bypassed.
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class NotFoundException extends RuntimeException {

    /**
     * @param message human-readable description of the missing entity
     */
    public NotFoundException(String message) {
        super(message);
    }
}
