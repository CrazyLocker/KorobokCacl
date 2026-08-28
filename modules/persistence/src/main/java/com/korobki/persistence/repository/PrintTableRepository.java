package com.korobki.persistence.repository;

import com.korobki.persistence.entity.PrintTable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrintTableRepository extends JpaRepository<PrintTable, java.util.UUID> {
    Optional<PrintTable> findByFormatId(Integer formatId);
    List<PrintTable> findAllByOrderByFormatIdAsc();
}
