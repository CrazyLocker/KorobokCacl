package com.korobki.calculator.service;

import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.repository.ConstructRepository;
import com.korobki.persistence.repository.PriceListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConstructService {

    private final ConstructRepository constructRepository;
    private final PriceListRepository priceListRepository;

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

    @Transactional
    public void deleteConstruct(UUID id) {
        // Remove the dependent price list first (FK construct_id, no cascade in DB)
        priceListRepository.deleteByConstructId(id);
        constructRepository.deleteById(id);
    }
}