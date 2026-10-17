package com.korobki.calculator.service;

import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.repository.ConstructRepository;
import com.korobki.persistence.repository.PriceListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service for box construction CRUD operations.
 */
@Service
@RequiredArgsConstructor
public class ConstructService {

    private final ConstructRepository constructRepository;
    private final PriceListRepository priceListRepository;

    /**
     * Returns all active (not soft-deleted) constructions.
     *
     * @return list of active constructions
     */
    public List<Construct> getAllActiveConstructs() {
        return constructRepository.findAllByIsActiveTrue();
    }

    /**
     * Finds a construction by its identifier.
     *
     * @param id construction identifier
     * @return the construction
     * @throws RuntimeException if not found
     */
    public Construct getConstructById(UUID id) {
        return constructRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Construct not found with id: " + id));
    }

    /**
     * Saves a construction (insert or update depending on id presence).
     *
     * @param construct construction to save
     * @return saved construction
     */
    public Construct saveConstruct(Construct construct) {
        return constructRepository.save(construct);
    }

    /**
     * Updates an existing construction's mutable fields.
     *
     * @param id        construction identifier
     * @param construct new field values
     * @return updated construction
     * @throws RuntimeException if not found
     */
    public Construct updateConstruct(UUID id, Construct construct) {
        Construct existing = getConstructById(id);
        existing.setName(construct.getName());
        existing.setDescription(construct.getDescription());
        existing.setParts(construct.getParts());
        existing.setIsActive(construct.getIsActive());
        return constructRepository.save(existing);
    }

    /**
     * Deletes a construction together with its dependent price list
     * (no DB cascade on construct_id).
     *
     * @param id construction identifier
     */
    @Transactional
    public void deleteConstruct(UUID id) {
        // Remove the dependent price list first (FK construct_id, no cascade in DB)
        priceListRepository.deleteByConstructId(id);
        constructRepository.deleteById(id);
    }
}