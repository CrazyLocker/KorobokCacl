package com.korobki.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Order node of the customer → order → calculation tree. */
@Data
public class OrderTreeDto {

    /** Order identifier. */
    private UUID id;

    /** Order number. */
    private String number;

    /** Date the order was placed. */
    private LocalDate orderDate;

    /** Lifecycle status. */
    private String status;

    /** Sum of the calculations' newest version cost. */
    private BigDecimal totalCost;

    /** Calculations of the order. */
    private List<CalculationTreeDto> calculations = new ArrayList<>();
}
