package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for a client the calculations are made for.
 *
 * <p>Replaces the free-text {@code clientName} of older calculations: the name
 * is unique (case-insensitive) so the same client is not entered twice.
 */
@Entity
@Table(name = "customers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Customer {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Client name as shown in lists and documents. */
    @Column(nullable = false)
    private String name;

    /** Client INN, optional. */
    private String inn;

    /** Contact person / phone / e-mail, optional. */
    private String contact;

    /** Whether the client can still be picked for new calculations. */
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

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
