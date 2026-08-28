package com.korobki.calculator.service;

import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.repository.ConstructRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConstructService {

    private final ConstructRepository constructRepository;

    public List<Construct> getAllActiveConstructs() {
        return constructRepository.findAllByIsActiveTrue();
    }

    public Construct getConstructById(UUID id) {
        return constructRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Construct not found with id: " + id));
    }
}