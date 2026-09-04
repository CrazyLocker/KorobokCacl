package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Calculation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CalculationRepository extends JpaRepository<Calculation, UUID> {

    List<Calculation> findAllByOrderByCreatedAtDesc();
}
