package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "knives")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Knife {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "svg_content", nullable = false, columnDefinition = "TEXT")
    private String svgContent;

    @Column(name = "total_length_mm", nullable = false)
    private BigDecimal totalLengthMm;

    @Column(name = "knife_cost", nullable = false)
    private BigDecimal knifeCost;

    @Column(name = "client_name", nullable = false)
    private String clientName;

    @Column(name = "manager_name", nullable = false)
    private String managerName;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
