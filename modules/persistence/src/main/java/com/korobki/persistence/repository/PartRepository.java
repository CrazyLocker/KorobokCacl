package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Part;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for construction parts.
 */
@Repository
public interface PartRepository extends JpaRepository<Part, UUID> {

    /**
     * Returns all parts of the given construction.
     *
     * @param constructId construction identifier
     * @return list of parts
     */
    List<Part> findByConstructId(UUID constructId);

    /**
     * Deletes all parts of the given construction.
     *
     * @param constructId construction identifier
     */
    void deleteByConstructId(UUID constructId);
}
