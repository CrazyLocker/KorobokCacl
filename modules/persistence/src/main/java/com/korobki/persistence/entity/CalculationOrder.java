package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for a client order born from a calculation version.
 *
 * <p>The client picks one variant of a calculation («третья версия») and the
 * order grows from exactly that version: {@code sourceCalculationId} points at
 * it. The calculation itself stays where it was, so every version remains in
 * the tree and one calculation may feed several orders over time.
 *
 * <p>The order stores only the deal header; its total is derived from the
 * source version.
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

    /** Calculation version the order grew from. */
    @Column(name = "source_calculation_id")
    private UUID sourceCalculationId;

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

    /**
     * Mark of deletion: the order stays in the tree struck through and may be
     * erased from the database only through the cleanup block.
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

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
