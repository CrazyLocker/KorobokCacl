package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Construct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConstructRepository extends JpaRepository<Construct, UUID> {
    List<Construct> findAllByIsActiveTrue();
}