package com.korobki.api.controller;

import com.korobki.persistence.entity.PriceList;
import com.korobki.persistence.repository.PriceListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

@RestController
@RequestMapping("/api/price-lists")
@RequiredArgsConstructor
public class PriceListController {

    private final PriceListRepository priceListRepository;

    @GetMapping("/by-construct/{constructId}")
    public ResponseEntity<PriceList> getByConstructId(@PathVariable UUID constructId) {
        return priceListRepository.findByConstructId(constructId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok().build());
    }

    @PostMapping
    public ResponseEntity<PriceList> createPriceList(@RequestBody PriceList priceList) {
        // Если id пустой или невалидный, генерируем новый UUID
        if (priceList.getId() == null || priceList.getId().toString().isBlank()) {
            priceList.setId(null);
        }
        return ResponseEntity.ok(priceListRepository.save(priceList));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PriceList> updatePriceList(@PathVariable UUID id, @RequestBody PriceList priceList) {
        PriceList existing = priceListRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Price list not found with id: " + id));
        existing.setConstructId(priceList.getConstructId());
        existing.setPriceData(priceList.getPriceData());
        return ResponseEntity.ok(priceListRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePriceList(@PathVariable UUID id) {
        priceListRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
