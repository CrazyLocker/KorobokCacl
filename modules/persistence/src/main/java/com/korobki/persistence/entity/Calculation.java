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
 * JPA entity for a saved box calculation.
 * Stores calculation input/output snapshot as JSON along with
 * client and manager attribution.
 */
@Entity
@Table(name = "calculations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Calculation {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Human-readable calculation name. */
    @Column(nullable = false)
    private String name;

    /** Client the calculation was made for. */
    @Column(name = "client_name", nullable = false)
    private String clientName;

    /** Manager who created the calculation. */
    @Column(name = "manager_name", nullable = false)
    private String managerName;

    /** Lifecycle status: draft, ready, sent, in_work, closed. */
    @Column(nullable = false)
    private String status = "draft";

    /** Full calculation request snapshot (JSON). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "calculation_state", columnDefinition = "JSONB", nullable = false)
    private Map<String, Object> calculationState;

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
