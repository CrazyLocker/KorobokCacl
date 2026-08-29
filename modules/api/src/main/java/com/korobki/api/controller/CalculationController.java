package com.korobki.api.controller;

import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationStateDto;
import com.korobki.api.service.CalculationStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/calculations")
@RequiredArgsConstructor
public class CalculationController {

    private final CalculationStorageService storageService;

    @PostMapping("/save")
    public ResponseEntity<CalculationStateDto> saveCalculation(
            @Valid @RequestBody CalculationSaveRequest request) {
        return ResponseEntity.ok(storageService.saveCalculation(request));
    }

    @GetMapping("/list")
    public ResponseEntity<List<CalculationStateDto>> getCalculations(
            @RequestParam String sessionId) {
        return ResponseEntity.ok(storageService.getCalculations(sessionId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CalculationStateDto> getCalculation(@PathVariable UUID id) {
        return ResponseEntity.ok(storageService.getCalculation(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCalculation(@PathVariable UUID id) {
        storageService.deleteCalculation(id);
        return ResponseEntity.ok().build();
    }
}
