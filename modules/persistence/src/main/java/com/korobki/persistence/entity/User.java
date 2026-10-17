package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;

/**
 * JPA entity for an application user.
 * Reserved for future authentication/authorization support.
 */
@Entity
@Table(name = "users")
@Data
public class User {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** User email (login), unique. */
    @Column(unique = true, nullable = false)
    private String email;

    /** Hashed password (never stored in plain text). */
    @Column(nullable = false)
    private String passwordHash;

    /** User role: "ADMIN", "MANAGER". */
    @Column(nullable = false)
    private String role; // "ADMIN", "MANAGER"
}