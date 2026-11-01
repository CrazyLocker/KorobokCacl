package com.korobki.api.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Client node of the customer → order → calculation tree. */
@Data
public class CustomerTreeDto {

    /** Client identifier; null for the bucket of legacy rows without a client. */
    private UUID id;

    /** Client name. */
    private String name;

    /** Orders of the client, newest first. */
    private List<OrderTreeDto> orders = new ArrayList<>();

    /** Calculations of the client that are not attached to an order yet. */
    private List<CalculationTreeDto> withoutOrder = new ArrayList<>();
}
