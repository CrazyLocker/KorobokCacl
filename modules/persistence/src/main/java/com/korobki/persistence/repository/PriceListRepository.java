package com.korobki.persistence.repository;

import com.korobki.persistence.entity.PriceList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PriceListRepository extends JpaRepository<PriceList, UUID> {
    Optional<PriceList> findByConstructId(UUID constructId);

    void deleteByConstructId(UUID constructId);
}
