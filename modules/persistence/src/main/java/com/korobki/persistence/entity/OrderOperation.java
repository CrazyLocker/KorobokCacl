package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_operations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderOperation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "operation_id")
    private UUID operationId;

    @Column(name = "operation_name", nullable = false)
    private String operationName;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "cost_per_unit", nullable = false)
    private BigDecimal costPerUnit;

    @Column(name = "total_cost", nullable = false)
    private BigDecimal totalCost;

    @Column(name = "is_active")
    private Boolean isActive = true;
}