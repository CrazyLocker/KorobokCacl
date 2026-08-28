package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_parts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderPart {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "part_name", nullable = false)
    private String partName;

    @Column(name = "parts_per_sheet", nullable = false)
    private Integer partsPerSheet;

    @Column(name = "cost_per_part", nullable = false)
    private BigDecimal costPerPart;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}