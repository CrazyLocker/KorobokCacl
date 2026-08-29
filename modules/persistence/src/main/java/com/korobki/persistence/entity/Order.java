package com.korobki.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_name", nullable = false)
    private String clientName;

    @Column(name = "client_inn")
    private String clientInn;

    @Column(name = "manager_id")
    private UUID managerId;

    @Column(name = "order_date")
    private LocalDateTime orderDate = LocalDateTime.now();

    @Column(name = "construct_id")
    private UUID constructId;

    @Column(name = "construct_name", nullable = false)
    private String constructName;

    @Column(name = "material_type", nullable = false)
    private String materialType;

    @Column(name = "purchase_price")
    private BigDecimal purchasePrice;

    @Column(name = "sheet_price", nullable = false)
    private BigDecimal sheetPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "base_price", nullable = false)
    private BigDecimal basePrice;

    @Column(nullable = false)
    private BigDecimal discount;

    @Column(name = "final_price_per_item", nullable = false)
    private BigDecimal finalPricePerItem;

    @Column(name = "total_price", nullable = false)
    private BigDecimal totalPrice;

    @Column(nullable = false)
    private String status = "draft";

    @Column(columnDefinition = "TEXT")
    private String comment;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "calculation_state", columnDefinition = "JSONB")
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