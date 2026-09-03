package com.korobki.api.controller;

import com.korobki.calculator.service.ConstructService;
import com.korobki.persistence.entity.Construct;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/constructs")
@RequiredArgsConstructor
public class ConstructController {

    private final ConstructService constructService;

    @GetMapping
    public List<Construct> getAllConstructs() {
        return constructService.getAllActiveConstructs();
    }

    @GetMapping("/{id}")
    public Construct getConstructById(@PathVariable UUID id) {
        return constructService.getConstructById(id);
    }

    @PostMapping
    public ResponseEntity<Construct> createConstruct(@RequestBody Construct construct) {
        // Если id пустой или невалидный, генерируем новый UUID
        if (construct.getId() == null || construct.getId().toString().isBlank()) {
            construct.setId(null);
        }
        return ResponseEntity.ok(constructService.saveConstruct(construct));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Construct> updateConstruct(@PathVariable UUID id, @RequestBody Construct construct) {
        return ResponseEntity.ok(constructService.updateConstruct(id, construct));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConstruct(@PathVariable UUID id) {
        constructService.deleteConstruct(id);
        return ResponseEntity.ok().build();
    }
}