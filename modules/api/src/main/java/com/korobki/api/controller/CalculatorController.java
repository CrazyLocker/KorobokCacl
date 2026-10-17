package com.korobki.api.controller;

import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

/**
 * REST controller for box price calculation.
 */
@RestController
@RequestMapping("/api/calculator")
@RequiredArgsConstructor
public class CalculatorController {

    private final CalculatorService calculatorService;

    /**
     * Calculates the box cost and client prices for the given input.
     *
     * @param request calculation input (construction, details, extras, print settings)
     * @return calculation result with cost breakdown and tier prices
     */
    @PostMapping("/calculate")
    public CalculationResponse calculate(@Valid @RequestBody CalculationRequest request) {
        return calculatorService.calculate(request);
    }
}
