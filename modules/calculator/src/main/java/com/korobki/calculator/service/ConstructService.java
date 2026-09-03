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

    public Construct saveConstruct(Construct construct) {
        return constructRepository.save(construct);
    }

    public Construct updateConstruct(UUID id, Construct construct) {
        Construct existing = getConstructById(id);
        existing.setName(construct.getName());
        existing.setDescription(construct.getDescription());
        existing.setParts(construct.getParts());
        existing.setIsActive(construct.getIsActive());
        return constructRepository.save(existing);
    }

    public void deleteConstruct(UUID id) {
        constructRepository.deleteById(id);
    }
}