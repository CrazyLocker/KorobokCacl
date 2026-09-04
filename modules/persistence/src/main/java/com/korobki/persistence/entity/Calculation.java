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

@Entity
@Table(name = "calculations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Calculation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "client_name", nullable = false)
    private String clientName;

    @Column(name = "manager_name", nullable = false)
    private String managerName;

    @Column(nullable = false)
    private String status = "draft";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "calculation_state", columnDefinition = "JSONB", nullable = false)
    private Map<String, Object> calculationState;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
