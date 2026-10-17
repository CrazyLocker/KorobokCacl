package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for a saved cutting knife.
 * Stores the knife SVG layout together with computed metrics
 * (total cut length and cost) and client/manager attribution.
 */
@Entity
@Table(name = "knives")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Knife {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Human-readable knife name. */
    @Column(nullable = false)
    private String name;

    /** SVG markup of the knife layout. */
    @Column(name = "svg_content", nullable = false, columnDefinition = "TEXT")
    private String svgContent;

    /** Total cutting length in millimeters. */
    @Column(name = "total_length_mm", nullable = false)
    private BigDecimal totalLengthMm;

    /** Computed knife cost (rubles). */
    @Column(name = "knife_cost", nullable = false)
    private BigDecimal knifeCost;

    /** Client the knife was made for. */
    @Column(name = "client_name", nullable = false)
    private String clientName;

    /** Manager who saved the knife. */
    @Column(name = "manager_name", nullable = false)
    private String managerName;

    /** Creation timestamp. */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /** Sets the creation timestamp before insert. */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
