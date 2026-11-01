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

    /**
     * Client name kept for rows saved before the customers reference book.
     * New calculations also fill {@link #customerId}; when it is set, the
     * customer's current name wins over this snapshot.
     */
    @Column(name = "client_name", nullable = false)
    private String clientName;

    /** Client reference the calculation was made for; null for legacy rows. */
    @Column(name = "customer_id")
    private UUID customerId;

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

    /**
     * Identifier of the first version in the chain.
     * The first version points at itself; later versions inherit the value.
     */
    @Column(name = "root_id")
    private UUID rootId;

    /**
     * Version this one was branched from.
     * Null for the first version of a chain: the tree is rooted at it.
     */
    @Column(name = "parent_id")
    private UUID parentId;

    /** Version number inside the branch, starting at 1 (parent + 1). */
    @Column(nullable = false)
    private Integer version = 1;

    /**
     * Soft-delete timestamp: the version is gone from the working tree but its
     * history is kept for the agreement with the client.
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /**
     * Calculation result computed when this version was saved (JSON snapshot).
     * Null for rows saved before versioning existed; they are recalculated on
     * read instead.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "calculation_result", columnDefinition = "JSONB")
    private Map<String, Object> calculationResult;

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
