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

/**
 * JPA entity for a printing price table.
 * Each table defines prices for one print format as a list of
 * quantity steps, plus the price increment after 3000 units.
 */
@Entity
@Table(name = "print_tables")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PrintTable {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Numeric format identifier referenced by print settings (unique). */
    @Column(name = "format_id", nullable = false, unique = true)
    private Integer formatId;

    /** Human-readable format name, e.g. "Малый формат (до 350×500)". */
    @Column(name = "format_name", nullable = false)
    private String formatName;

    /** Price steps: [{"minQty": 100, "price": 5500}, ...]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "steps", columnDefinition = "JSONB", nullable = false)
    private List<Map<String, Object>> steps;

    /** Price increment per 1000 units for quantities above 3000. */
    @Column(name = "step_after_3000", nullable = false)
    private BigDecimal stepAfter3000;

    /** Creation timestamp. */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /** Sets the creation timestamp before insert. */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
