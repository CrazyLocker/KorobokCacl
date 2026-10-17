package com.korobki.persistence.repository;

import com.korobki.persistence.entity.PrintTable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for printing price tables.
 */
@Repository
public interface PrintTableRepository extends JpaRepository<PrintTable, java.util.UUID> {

    /**
     * Finds a print table by its numeric format identifier.
     *
     * @param formatId numeric format identifier
     * @return the matching print table, if any
     */
    Optional<PrintTable> findByFormatId(Integer formatId);

    /**
     * Returns all print tables ordered by format identifier.
     *
     * @return list of print tables
     */
    List<PrintTable> findAllByOrderByFormatIdAsc();
}
