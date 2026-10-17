package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * JPA entity for a price list attached to a construction.
 * Prices are stored as a JSON map of tier label to value.
 */
@Entity
@Table(name = "price_lists")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriceList {

    /** Primary key (also used as the price list code in the UI). */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Reference to the construction this price list belongs to. */
    @Column(name = "construct_id", nullable = false)
    private UUID constructId;

    /** Price data map, e.g. {"до 9": 34, "10–49": 27, ...}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "price_data", columnDefinition = "JSONB", nullable = false)
    private Map<String, Object> priceData;

    /** Creation timestamp. */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /** Sets the creation timestamp before insert. */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
