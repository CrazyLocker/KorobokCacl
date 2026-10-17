package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for an additional operation (lamination, varnish, etc.)
 * with its base price. Inactive operations are hidden from the calculator.
 */
@Entity
@Table(name = "operations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Operation {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Operation name, e.g. "Ламинация (глянец)". */
    @Column(nullable = false)
    private String name;

    /** Measurement unit, e.g. "м²", "шт". */
    @Column(nullable = false)
    private String unit;

    /** Base price per unit (rubles). */
    @Column(name = "base_price", nullable = false)
    private BigDecimal basePrice;

    /** Price type, currently always "fixed". */
    @Column(name = "price_type")
    private String priceType = "fixed";

    /** Soft-delete flag; inactive operations are hidden from selection. */
    @Column(name = "is_active")
    private Boolean isActive = true;

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
    }

    /** Refreshes the update timestamp before each update. */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}