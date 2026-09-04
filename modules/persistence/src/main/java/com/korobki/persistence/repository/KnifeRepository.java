package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Knife;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface KnifeRepository extends JpaRepository<Knife, UUID> {

    List<Knife> findAllByOrderByCreatedAtDesc();
}
