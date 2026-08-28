package com.korobki.api.controller;

import com.korobki.calculator.service.ConstructService;
import com.korobki.persistence.entity.Construct;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}