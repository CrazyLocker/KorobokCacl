package com.korobki.persistence.repository;

import com.korobki.persistence.entity.OrderPart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderPartRepository extends JpaRepository<OrderPart, UUID> {
    List<OrderPart> findAllByOrderIdOrderBySortOrderAsc(UUID orderId);
}