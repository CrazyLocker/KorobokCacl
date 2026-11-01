package com.korobki.api.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Client node of the customer → order/calculation tree. */
@Data
public class CustomerTreeDto {

    /** Client identifier; null for the bucket of legacy rows without a client. */
    private UUID id;

    /** Client name. */
    private String name;

    /** Orders placed by the client, newest first. */
    private List<OrderTreeDto> orders = new ArrayList<>();

    /** Calculation trees of the client; versions stay here after an order is placed. */
    private List<CalculationTreeDto> calculations = new ArrayList<>();
}
