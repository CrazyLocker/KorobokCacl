package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Calculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for saved calculations.
 */
public interface CalculationRepository extends JpaRepository<Calculation, UUID> {

    /**
     * Returns one row per version chain: the latest version of each root.
     *
     * <p>The list screen shows calculations, not their history, so older
     * versions of an edited calculation stay in the database but are not listed.
     *
     * @return latest version of every chain, most recently updated first
     */
    @Query("""
            SELECT c FROM Calculation c
            WHERE c.version = (
                SELECT MAX(c2.version) FROM Calculation c2 WHERE c2.rootId = c.rootId)
            ORDER BY c.updatedAt DESC
            """)
    List<Calculation> findAllHeads();

    /**
     * Returns every version of a chain, newest first.
     *
     * @param rootId identifier of the first version
     * @return versions of the chain, newest first
     */
    List<Calculation> findByRootIdOrderByVersionDesc(UUID rootId);

    /**
     * Returns the latest version of a chain.
     *
     * @param rootId identifier of the first version
     * @return latest version, if the chain exists
     */
    Optional<Calculation> findTopByRootIdOrderByVersionDesc(UUID rootId);
}
