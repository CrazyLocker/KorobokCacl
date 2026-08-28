package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface MaterialRepository extends JpaRepository<Material, UUID> {
    List<Material> findAllByIsActiveTrue();
    List<Material> findByTypeAndMinPurchasePriceLessThanEqualAndMaxPurchasePriceGreaterThanEqual(
            Material.MaterialType type,
            BigDecimal minPrice,
            BigDecimal maxPrice
    );
}