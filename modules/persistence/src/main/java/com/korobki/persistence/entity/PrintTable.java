package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "print_tables")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PrintTable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "format_id", nullable = false, unique = true)
    private Integer formatId;

    @Column(name = "format_name", nullable = false)
    private String formatName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "steps", columnDefinition = "JSONB", nullable = false)
    private List<Map<String, Object>> steps;

    @Column(name = "step_after_3000", nullable = false)
    private BigDecimal stepAfter3000;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
