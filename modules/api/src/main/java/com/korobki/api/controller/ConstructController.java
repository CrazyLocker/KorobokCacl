package com.korobki.api.controller;

import com.korobki.calculator.service.ConstructService;
import com.korobki.persistence.entity.Construct;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for box constructions (CRUD).
 */
@RestController
@RequestMapping("/api/constructs")
@RequiredArgsConstructor
public class ConstructController {

    private final ConstructService constructService;

    /**
     * Returns all active constructions.
     *
     * @return list of active constructions
     */
    @GetMapping
    public List<Construct> getAllConstructs() {
        return constructService.getAllActiveConstructs();
    }

    /**
     * Returns a construction by its identifier.
     *
     * @param id construction identifier
     * @return the construction
     */
    @GetMapping("/{id}")
    public Construct getConstructById(@PathVariable UUID id) {
        return constructService.getConstructById(id);
    }

    /**
     * Creates a construction. A blank id is replaced with a generated UUID.
     *
     * @param construct construction to create
     * @return the created construction
     */
    @PostMapping
    public ResponseEntity<Construct> createConstruct(@RequestBody Construct construct) {
        // Если id пустой или невалидный, генерируем новый UUID
        if (construct.getId() == null || construct.getId().toString().isBlank()) {
            construct.setId(null);
        }
        return ResponseEntity.ok(constructService.saveConstruct(construct));
    }

    /**
     * Updates an existing construction.
     *
     * @param id        construction identifier
     * @param construct new field values
     * @return the updated construction
     */
    @PutMapping("/{id}")
    public ResponseEntity<Construct> updateConstruct(@PathVariable UUID id, @RequestBody Construct construct) {
        return ResponseEntity.ok(constructService.updateConstruct(id, construct));
    }

    /**
     * Deletes a construction together with its dependent price list.
     *
     * @param id construction identifier
     * @return empty response
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConstruct(@PathVariable UUID id) {
        constructService.deleteConstruct(id);
        return ResponseEntity.ok().build();
    }
}