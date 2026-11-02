package com.korobki.persistence.repository;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Aggregated view of one calculation version tree.
 *
 * <p>Used by the list screen: a calculation is shown once, while its versions
 * may branch, so the row needs the deepest number, the total count and the
 * time of the last change in the whole tree.
 */
public interface CalculationChainSummary {

    /** Identifier of the first version (the tree root). */
    UUID getRootId();

    /** Deepest version number in the tree. */
    Integer getVersion();

    /** Number of versions in the tree, deleted ones included. */
    Long getVersionCount();

    /** Number of versions that are not marked deleted; 0 means the whole tree is deleted. */
    Long getLiveCount();

    /** Time of the last change anywhere in the tree. */
    LocalDateTime getLastUpdated();
}
