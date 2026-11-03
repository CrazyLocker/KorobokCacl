package com.korobki.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Outcome of the cleanup block: how many rows were actually erased.
 */
@Data
@AllArgsConstructor
public class PurgeResultDto {

    /** Number of rows removed from the database. */
    private int deleted;
}
