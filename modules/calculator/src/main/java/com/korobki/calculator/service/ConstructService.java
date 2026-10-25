package com.korobki.calculator.service;

import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.entity.Material;
import com.korobki.persistence.entity.Part;
import com.korobki.persistence.repository.ConstructRepository;
import com.korobki.persistence.repository.MaterialRepository;
import com.korobki.persistence.repository.PriceListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
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
    private final MaterialRepository materialRepository;

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
     * Part identifiers are ignored: the database generates new ones.
     *
     * @param construct construction to save
     * @return saved construction
     */
    @Transactional
    public Construct saveConstruct(Construct construct) {
        if (construct.getParts() == null) {
            construct.setParts(new ArrayList<>());
        }
        for (Part part : construct.getParts()) {
            part.setId(null);
            part.setConstruct(construct);
            part.setMaterial(resolveMaterial(part.getMaterial()));
        }
        return constructRepository.save(construct);
    }

    /**
     * Updates an existing construction's mutable fields.
     * Parts are replaced as a whole because the reference book UI edits
     * the complete list at once.
     *
     * @param id        construction identifier
     * @param construct new field values
     * @return updated construction
     * @throws RuntimeException if not found
     */
    @Transactional
    public Construct updateConstruct(UUID id, Construct construct) {
        Construct existing = getConstructById(id);
        existing.setName(construct.getName());
        existing.setDescription(construct.getDescription());
        existing.setIsActive(construct.getIsActive());
        if (construct.getType() != null) {
            existing.setType(construct.getType());
        }
        List<Part> newParts = construct.getParts() == null ? List.of() : construct.getParts();
        return replaceParts(existing, newParts);
    }

    /**
     * Replaces all parts of the construction. Existing rows are flushed as
     * deleted before new ones are inserted, so the unique constraint
     * {@code (construct_id, name)} is never violated.
     *
     * @param construct managed construction
     * @param newParts  new part values (identifiers are ignored)
     * @return the construction with the new parts
     */
    @Transactional
    public Construct replaceParts(Construct construct, List<Part> newParts) {
        construct.getParts().clear();
        constructRepository.saveAndFlush(construct);

        for (Part source : newParts) {
            Part part = new Part();
            part.setName(source.getName());
            part.setPerSheet(source.getPerSheet());
            part.setMaterial(resolveMaterial(source.getMaterial()));
            part.setConstruct(construct);
            construct.getParts().add(part);
        }
        return constructRepository.save(construct);
    }

    /**
     * Deletes a construction together with its dependent price list
     * (no DB cascade on construct_id). Parts are removed by JPA cascade
     * and by the {@code ON DELETE CASCADE} foreign key.
     *
     * @param id construction identifier
     */
    @Transactional
    public void deleteConstruct(UUID id) {
        // Remove the dependent price list first (FK construct_id, no cascade in DB)
        priceListRepository.deleteByConstructId(id);
        constructRepository.deleteById(id);
    }

    /**
     * Resolves a material reference sent by the client. Only the identifier
     * is trusted; name/price always come from the materials table.
     *
     * @param material material reference from the request
     * @return managed material reference
     */
    private Material resolveMaterial(Material material) {
        if (material == null || material.getId() == null) {
            throw new IllegalArgumentException("Material is required for every part");
        }
        return materialRepository.getReferenceById(material.getId());
    }
}