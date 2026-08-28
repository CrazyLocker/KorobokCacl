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
}
