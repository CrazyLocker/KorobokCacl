package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Knife;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for saved knives.
 */
public interface KnifeRepository extends JpaRepository<Knife, UUID> {

    /**
     * Returns all knives ordered by creation date, newest first.
     *
     * @return list of saved knives
     */
    List<Knife> findAllByOrderByCreatedAtDesc();
}
