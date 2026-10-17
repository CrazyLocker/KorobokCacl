package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Calculation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for saved calculations.
 */
public interface CalculationRepository extends JpaRepository<Calculation, UUID> {

    /**
     * Returns all calculations ordered by creation date, newest first.
     *
     * @return list of saved calculations
     */
    List<Calculation> findAllByOrderByCreatedAtDesc();
}
