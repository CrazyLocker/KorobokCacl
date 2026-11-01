package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for a client order: a folder of calculations for one deal.
 *
 * <p>Several calculation trees (different constructions or print variants) may
 * belong to one order. The order itself stores only the deal header; its total
 * is derived from the calculations.
 */
@Entity
@Table(name = "calculation_orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CalculationOrder {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Client the order belongs to. */
    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    /** Order number, unique per client. */
    @Column(nullable = false)
    private String number;

    /** Date the order was placed. */
    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    /** Lifecycle status: draft, ready, sent, in_work, closed. */
    @Column(nullable = false)
    private String status = "draft";

    /** Free-form note about the deal. */
    private String comment;

    /** Creation timestamp. */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Sets creation/update timestamps before insert. */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (orderDate == null) {
            orderDate = LocalDate.now();
        }
    }

    /** Refreshes the update timestamp before each update. */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
