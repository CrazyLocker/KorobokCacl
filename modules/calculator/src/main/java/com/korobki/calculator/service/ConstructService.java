package com.korobki.calculator.service;

import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.entity.Part;
import com.korobki.persistence.repository.ConstructRepository;
import com.korobki.persistence.repository.PriceListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
            part.setPricePerSheet(resolvePrice(part.getPricePerSheet()));
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
            part.setPricePerSheet(resolvePrice(source.getPricePerSheet()));
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
     * Returns the sheet price sent by the client, defaulting to zero when
     * it is absent. The cardboard kind is no longer part of the model, so
     * the price is the only material characteristic a part carries.
     *
     * @param price sheet price from the request
     * @return non-null sheet price
     */
    private BigDecimal resolvePrice(BigDecimal price) {
        return price != null ? price : BigDecimal.ZERO;
    }
}