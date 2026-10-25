package com.korobki.persistence.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.UUID;

/**
 * JPA entity for a construction detail (part).
 * <p>The sheet price is not stored on the part: it is resolved from
 * {@link #material} so that the materials reference book remains the
 * single source of truth for prices.</p>
 */
@Entity
@Table(name = "parts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Part {

    /** Primary key. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Owning construction. Hidden from JSON to avoid a serialization cycle. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "construct_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Construct construct;

    /** Detail name (unique within the construction). */
    @Column(nullable = false)
    private String name;

    /** Number of details placed on one sheet. */
    @Column(name = "per_sheet", nullable = false)
    private int perSheet;

    /** Sheet material that determines the price of this detail. */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;
}
