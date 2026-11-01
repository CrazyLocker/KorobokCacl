package com.korobki.api.controller;

import com.korobki.api.dto.CalculationOrderDto;
import com.korobki.api.dto.CalculationOrderSaveRequest;
import com.korobki.api.service.CalculationOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for client orders (deals that group calculations).
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class CalculationOrderController {

    private final CalculationOrderService orderService;

    /**
     * Lists orders with the number and cost of their calculations.
     *
     * @param customerId optional client filter
     * @return orders, newest first
     */
    @GetMapping
    public ResponseEntity<List<CalculationOrderDto>> list(
            @RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(orderService.list(customerId));
    }

    /**
     * Returns one order.
     *
     * @param id order identifier
     * @return the order
     */
    @GetMapping("/{id}")
    public ResponseEntity<CalculationOrderDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(orderService.get(id));
    }

    /**
     * Creates an order; a blank number is generated as {@code <year>-<number>}.
     *
     * @param request order details
     * @return the stored order
     */
    @PostMapping
    public ResponseEntity<CalculationOrderDto> create(@Valid @RequestBody CalculationOrderSaveRequest request) {
        return ResponseEntity.ok(orderService.create(request));
    }

    /**
     * Updates an order. The client cannot be changed.
     *
     * @param id      order identifier
     * @param request new values
     * @return the updated order
     */
    @PutMapping("/{id}")
    public ResponseEntity<CalculationOrderDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody CalculationOrderSaveRequest request) {
        return ResponseEntity.ok(orderService.update(id, request));
    }
}
