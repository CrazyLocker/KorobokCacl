package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for sheet materials.
 */
@Repository
public interface MaterialRepository extends JpaRepository<Material, UUID> {

    /**
     * Returns all active (not soft-deleted) materials.
     *
     * @return list of active materials
     */
    List<Material> findAllByIsActiveTrue();

    /**
     * Finds a material by its name (case-insensitive).
     *
     * @param name material name
     * @return the first matching material, if any
     */
    Optional<Material> findFirstByNameIgnoreCase(String name);

    /**
     * Finds active materials of the given type whose purchase price
     * fits within the specified range (inclusive on both ends).
     *
     * @param type     material category
     * @param minPrice lower bound of purchase price
     * @param maxPrice upper bound of purchase price
     * @return list of matching materials
     */
    List<Material> findByTypeAndMinPurchasePriceLessThanEqualAndMaxPurchasePriceGreaterThanEqual(
            Material.MaterialType type,
            BigDecimal minPrice,
            BigDecimal maxPrice
    );
}