package com.korobki.api.controller;

import com.korobki.calculator.service.OperationService;
import com.korobki.persistence.entity.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operations")
@RequiredArgsConstructor
public class OperationController {

    private final OperationService operationService;

    @GetMapping
    public List<Operation> getAllOperations() {
        return operationService.getAllActiveOperations();
    }

    @GetMapping("/{id}")
    public Operation getOperationById(@PathVariable UUID id) {
        return operationService.getOperationById(id);
    }
}
