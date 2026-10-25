package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * JPA entity for a box construction (set of parts and their layout
 * parameters). Parts are stored in the {@code parts} table and reference
 * their sheet material.
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

    /** Construction type used to group models and pick default materials. */
    @Enumerated(EnumType.STRING)
    @Column(name = "type")
    private ConstructType type;

    /** Parts of the construction with their material references. */
    @OneToMany(mappedBy = "construct", cascade = CascadeType.ALL, orphanRemoval = true,
            fetch = FetchType.EAGER)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Part> parts = new ArrayList<>();

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