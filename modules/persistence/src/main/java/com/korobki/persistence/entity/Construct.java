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
 * JPA entity for a box construction (set of parts and their layout
 * parameters). Parts are stored as a JSON document.
 */
@Entity
@Table(name = "constructs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Construct {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Construction name (unique among active constructions). */
    @Column(nullable = false)
    private String name;

    /** Optional description. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** Parts layout document, e.g. {"parts": [{"name": "Дно", "perSheet": 6}, ...]}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSONB", nullable = false)
    private Map<String, Object> parts; // Хранит список деталей в формате JSON

    /** Soft-delete flag; inactive constructions are hidden from selection. */
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