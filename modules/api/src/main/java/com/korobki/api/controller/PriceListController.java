package com.korobki.api.controller;

import com.korobki.persistence.entity.PriceList;
import com.korobki.persistence.repository.PriceListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

/**
 * REST controller for price lists (CRUD).
 */
@RestController
@RequestMapping("/api/price-lists")
@RequiredArgsConstructor
public class PriceListController {

    private final PriceListRepository priceListRepository;

    /**
     * Returns the price list of the given construction.
     *
     * @param constructId construction identifier
     * @return the price list, or empty body if none exists
     */
    @GetMapping("/by-construct/{constructId}")
    public ResponseEntity<PriceList> getByConstructId(@PathVariable UUID constructId) {
        return priceListRepository.findByConstructId(constructId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok().build());
    }

    /**
     * Creates a price list. A blank id is replaced with a generated UUID.
     *
     * @param priceList price list to create
     * @return the created price list
     */
    @PostMapping
    public ResponseEntity<PriceList> createPriceList(@RequestBody PriceList priceList) {
        // Если id пустой или невалидный, генерируем новый UUID
        if (priceList.getId() == null || priceList.getId().toString().isBlank()) {
            priceList.setId(null);
        }
        return ResponseEntity.ok(priceListRepository.save(priceList));
    }

    /**
     * Updates an existing price list.
     *
     * @param id        price list identifier
     * @param priceList new field values
     * @return the updated price list
     * @throws RuntimeException if not found
     */
    @PutMapping("/{id}")
    public ResponseEntity<PriceList> updatePriceList(@PathVariable UUID id, @RequestBody PriceList priceList) {
        PriceList existing = priceListRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Price list not found with id: " + id));
        existing.setConstructId(priceList.getConstructId());
        existing.setPriceData(priceList.getPriceData());
        return ResponseEntity.ok(priceListRepository.save(existing));
    }

    /**
     * Deletes a price list.
     *
     * @param id price list identifier
     * @return empty response
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePriceList(@PathVariable UUID id) {
        priceListRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
