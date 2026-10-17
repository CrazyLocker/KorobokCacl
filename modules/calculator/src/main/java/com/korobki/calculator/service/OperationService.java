package com.korobki.calculator.service;

import com.korobki.persistence.entity.Operation;
import com.korobki.persistence.repository.OperationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Service for additional operations reference data.
 */
@Service
@RequiredArgsConstructor
public class OperationService {

    private final OperationRepository operationRepository;

    /**
     * Returns all active (not soft-deleted) operations.
     *
     * @return list of active operations
     */
    public List<Operation> getAllActiveOperations() {
        return operationRepository.findAllByIsActiveTrue();
    }

    /**
     * Finds an operation by its identifier.
     *
     * @param id operation identifier
     * @return the operation
     * @throws RuntimeException if not found
     */
    public Operation getOperationById(UUID id) {
        return operationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Operation not found with id: " + id));
    }
}