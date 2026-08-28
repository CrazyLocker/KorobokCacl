package com.korobki.calculator.service;

import com.korobki.persistence.entity.Operation;
import com.korobki.persistence.repository.OperationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OperationService {

    private final OperationRepository operationRepository;

    public List<Operation> getAllActiveOperations() {
        return operationRepository.findAllByIsActiveTrue();
    }

    public Operation getOperationById(UUID id) {
        return operationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Operation not found with id: " + id));
    }
}