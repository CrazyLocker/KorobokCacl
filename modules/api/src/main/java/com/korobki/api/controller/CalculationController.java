package com.korobki.api.controller;

import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.service.CalculationService;
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

    private final CalculationService calculationService;

    @PostMapping("/save")
    public ResponseEntity<CalculationDto> save(@Valid @RequestBody CalculationSaveRequest request) {
        return ResponseEntity.ok(calculationService.save(request));
    }

    @GetMapping("/list")
    public ResponseEntity<List<CalculationDto>> list() {
        return ResponseEntity.ok(calculationService.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CalculationDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(calculationService.get(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        calculationService.delete(id);
        return ResponseEntity.ok().build();
    }
}
