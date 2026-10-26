package com.korobki.persistence.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * JPA entity for a construction detail (part).
 * <p>The price of a sheet is stored on the part itself ({@link #pricePerSheet}):
 * the calculator only needs the price, while the cardboard kind is
 * deliberately kept out of the model.</p>
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

    /** Price of one sheet (rubles) used to cost this detail. */
    @Column(name = "price_per_sheet", nullable = false)
    private BigDecimal pricePerSheet;
}
