package com.korobki.api.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Identifiers picked in the cleanup block of the settings page.
 *
 * <p>Erasing from the database is a separate step from marking: the block sends
 * the ticks of the manager, and the service erases only rows that are already
 * marked as deleted.
 */
@Data
public class PurgeRequest {

    /** Identifiers of the rows to erase for good. */
    private List<UUID> ids = new ArrayList<>();
}
