package com.korobki.api.controller;

import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/calculator")
@RequiredArgsConstructor
public class CalculatorController {

    private final CalculatorService calculatorService;

    @PostMapping("/calculate")
    public CalculationResponse calculate(@RequestBody CalculationRequest request) {
        return calculatorService.calculate(request);
    }
}
