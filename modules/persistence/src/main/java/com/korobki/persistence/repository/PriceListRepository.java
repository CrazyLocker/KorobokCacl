package com.korobki.persistence.repository;

import com.korobki.persistence.entity.PriceList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for price lists attached to constructions.
 */
@Repository
public interface PriceListRepository extends JpaRepository<PriceList, UUID> {

    /**
     * Finds the price list of the given construction.
     *
     * @param constructId construction identifier
     * @return the price list, if present
     */
    Optional<PriceList> findByConstructId(UUID constructId);

    /**
     * Deletes the price list of the given construction, if present.
     * Used before deleting the construction itself (no DB cascade).
     *
     * @param constructId construction identifier
     */
    void deleteByConstructId(UUID constructId);
}
