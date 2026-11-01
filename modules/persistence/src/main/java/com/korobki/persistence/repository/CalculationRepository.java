package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Calculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository for saved calculations.
 */
public interface CalculationRepository extends JpaRepository<Calculation, UUID> {

    /**
     * Returns the whole version tree of a calculation, oldest branch first.
     *
     * <p>The chain is resolved through the root id, so any version id can be
     * passed. The service rebuilds the tree from {@code parentId}: versions are
     * branches, not a single line.
     *
     * @param rootId identifier of the first version
     * @return every version of the calculation, oldest first
     */
    List<Calculation> findByRootIdOrderByVersionAsc(UUID rootId);

    /**
     * Returns one summary row per live calculation.
     *
     * <p>The list screen shows calculations, not their history, and a tree may
     * have several tips, so the row carries the deepest version number and the
     * number of versions instead of pointing at a single "head".
     *
     * @return live calculations with their tree statistics, most recently
     *         updated first
     */
    @Query("""
            SELECT c.rootId AS rootId,
                   MAX(c.version) AS version,
                   COUNT(c) AS versionCount,
                   MAX(c.updatedAt) AS lastUpdated
            FROM Calculation c
            WHERE c.deletedAt IS NULL
            GROUP BY c.rootId
            ORDER BY MAX(c.updatedAt) DESC
            """)
    List<CalculationChainSummary> findChainSummary();
}
