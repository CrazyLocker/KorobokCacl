package com.korobki.persistence.repository;

import com.korobki.persistence.entity.CalculationOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for client orders.
 */
public interface CalculationOrderRepository extends JpaRepository<CalculationOrder, UUID> {

    /**
     * Lists orders of one client, newest first.
     *
     * @param customerId client identifier
     * @return the client's orders
     */
    List<CalculationOrder> findByCustomerIdOrderByOrderDateDescCreatedAtDesc(UUID customerId);

    /**
     * Lists every order, newest first, for the order tree screen.
     *
     * @return all orders
     */
    List<CalculationOrder> findAllByOrderByOrderDateDescCreatedAtDesc();

    /**
     * Finds an order by number inside a client, ignoring case.
     *
     * @param customerId client identifier
     * @param number     order number
     * @return the order when present
     */
    Optional<CalculationOrder> findByCustomerIdAndNumberIgnoreCase(UUID customerId, String number);
}
