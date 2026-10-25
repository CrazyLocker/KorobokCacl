package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for a sheet material with its price characteristics.
 */
@Entity
@Table(name = "materials")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Material {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Material name. */
    @Column(nullable = false)
    private String name;

    /** Material category. */
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MaterialType type;

    /** Price per sheet (rubles). */
    @Column(name = "price_per_sheet", nullable = false)
    private BigDecimal pricePerSheet;

    /** Minimum purchase price (rubles), optional. */
    @Column(name = "min_purchase_price")
    private BigDecimal minPurchasePrice;

    /** Maximum purchase price (rubles), optional. */
    @Column(name = "max_purchase_price")
    private BigDecimal maxPurchasePrice;

    /** Soft-delete flag; inactive materials are hidden from selection. */
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

    /**
     * Supported material categories.
     * <p>Список расширяется по мере подключения новых материалов:
     * в перспективе — ГК и МГК.</p>
     */
    public enum MaterialType {
        coated, designer, pvc
    }
}