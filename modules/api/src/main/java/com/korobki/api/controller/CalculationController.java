package com.korobki.api.controller;

import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.service.CalculationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for saved calculations (CRUD).
 */
@RestController
@RequestMapping("/api/calculations")
@RequiredArgsConstructor
public class CalculationController {

    private final CalculationService calculationService;

    /**
     * Saves a new calculation.
     *
     * @param request calculation data (name, client, manager, state)
     * @return the saved calculation
     */
    @PostMapping("/save")
    public ResponseEntity<CalculationDto> save(@Valid @RequestBody CalculationSaveRequest request) {
        return ResponseEntity.ok(calculationService.save(request));
    }

    /**
     * Lists all saved calculations, newest first.
     *
     * @return list of saved calculations
     */
    @GetMapping("/list")
    public ResponseEntity<List<CalculationDto>> list() {
        return ResponseEntity.ok(calculationService.list());
    }

    /**
     * Returns a saved calculation by its identifier.
     *
     * @param id calculation identifier
     * @return the calculation
     */
    @GetMapping("/{id}")
    public ResponseEntity<CalculationDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(calculationService.get(id));
    }

    /**
     * Returns a read-only view of a saved calculation: metadata, the stored
     * request and the result recomputed from it.
     *
     * @param id calculation identifier
     * @return calculation view
     */
    @GetMapping("/{id}/view")
    public ResponseEntity<CalculationViewDto> view(@PathVariable UUID id) {
        return ResponseEntity.ok(calculationService.view(id));
    }

    /**
     * Deletes a saved calculation.
     *
     * @param id calculation identifier
     * @return empty response
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        calculationService.delete(id);
        return ResponseEntity.ok().build();
    }
}
