package com.korobki.persistence.repository;

import com.korobki.persistence.entity.OrderOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderOperationRepository extends JpaRepository<OrderOperation, UUID> {
    List<OrderOperation> findAllByOrderIdAndIsActiveTrue(UUID orderId);
}