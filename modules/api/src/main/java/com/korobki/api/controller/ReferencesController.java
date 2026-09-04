package com.korobki.api.controller;

import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.entity.PriceList;
import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.ConstructRepository;
import com.korobki.persistence.repository.PriceListRepository;
import com.korobki.persistence.repository.PrintTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST controller for importing reference data via JSON.
 * Matches the import formats from the HTML prototype.
 */
@RestController
@RequestMapping("/api/references")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ReferencesController {

    private final ConstructRepository constructRepository;
    private final PriceListRepository priceListRepository;
    private final PrintTableRepository printTableRepository;

    /**
     * Import constructions from JSON.
     *
     * Expected format (from HTML prototype):
     * {
     *   "Конструкция1": {
     *     "parts": {"Дно": 6, "Крышка": 4, ...},
     *     "sheetPrices": {"Дно": 35, "Крышка": 35, ...}
     *   },
     *   ...
     * }
     */
    @PostMapping("/import-constructs")
    public ResponseEntity<Map<String, Object>> importConstructs(@RequestBody Map<String, Object> json) {
        int imported = 0;
        int updated = 0;

        for (Map.Entry<String, Object> entry : json.entrySet()) {
            String name = entry.getKey();
            Map<String, Object> data = (Map<String, Object>) entry.getValue();

            @SuppressWarnings("unchecked")
            Map<String, Object> parts = (Map<String, Object>) data.getOrDefault("parts", Collections.emptyMap());

            // Convert parts map to the format expected by Construct entity
            List<Map<String, Object>> partsList = parts.entrySet().stream()
                    .map(e -> {
                        Map<String, Object> part = new HashMap<>();
                        part.put("name", e.getKey());
                        part.put("perSheet", e.getValue());
                        return part;
                    })
                    .collect(Collectors.toList());

            Construct existing = constructRepository.findAll().stream()
                    .filter(c -> c.getName().equals(name))
                    .findFirst()
                    .orElse(null);

            if (existing != null) {
                existing.setParts(Map.of("parts", partsList));
                existing.setUpdatedAt(LocalDateTime.now());
                constructRepository.save(existing);
                updated++;
            } else {
                Construct construct = new Construct();
                construct.setName(name);
                construct.setDescription((String) data.getOrDefault("description", ""));
                construct.setParts(Map.of("parts", partsList));
                construct.setIsActive(true);
                constructRepository.save(construct);
                imported++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("imported", imported);
        result.put("updated", updated);
        result.put("total", json.size());
        return ResponseEntity.ok(result);
    }

    /**
     * Import price lists from JSON.
     *
     * Expected format (from HTML prototype):
     * {
     *   "Конструкция1": {"до 9": 34, "10–49": 27, ...},
     *   ...
     * }
     *
     * Or array format:
     * {
     *   "items": [
     *     {"name": "Конструкция1", "prices": {"до 9": 34, ...}},
     *     ...
     *   ]
     * }
     */
    @PostMapping("/import-price-lists")
    public ResponseEntity<Map<String, Object>> importPriceLists(@RequestBody Map<String, Object> json) {
        int imported = 0;
        int updated = 0;

        Map<String, Map<String, Object>> priceDataMap;

        // Check for array format with "items" key
        if (json.containsKey("items")) {
            List<Map<String, Object>> items = (List<Map<String, Object>>) json.get("items");
            priceDataMap = new HashMap<>();
            for (Map<String, Object> item : items) {
                String name = (String) item.get("name");
                Map<String, Object> prices = (Map<String, Object>) item.get("prices");
                if (name != null && prices != null) {
                    priceDataMap.put(name, prices);
                }
            }
        } else {
            // Direct map format
            @SuppressWarnings("unchecked")
            Map<String, Object> directMap = (Map<String, Object>) json;
            priceDataMap = new HashMap<>();
            for (Map.Entry<String, Object> entry : directMap.entrySet()) {
                priceDataMap.put(entry.getKey(), (Map<String, Object>) entry.getValue());
            }
        }

        // Find existing constructs and match price lists by name
        List<Construct> allConstructs = constructRepository.findAll();
        for (Map.Entry<String, Map<String, Object>> entry : priceDataMap.entrySet()) {
            String constructName = entry.getKey();
            Map<String, Object> prices = entry.getValue();

            Construct construct = allConstructs.stream()
                    .filter(c -> c.getName().equals(constructName))
                    .findFirst()
                    .orElse(null);

            if (construct == null) {
                continue; // Skip constructs that don't exist
            }

            Optional<PriceList> existingPriceList = priceListRepository.findByConstructId(construct.getId());

            if (existingPriceList.isPresent()) {
                existingPriceList.get().setPriceData(prices);
                priceListRepository.save(existingPriceList.get());
                updated++;
            } else {
                PriceList priceList = new PriceList();
                priceList.setConstructId(construct.getId());
                priceList.setPriceData(prices);
                priceListRepository.save(priceList);
                imported++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("imported", imported);
        result.put("updated", updated);
        result.put("total", priceDataMap.size());
        return ResponseEntity.ok(result);
    }

    /**
     * Import print tables from JSON.
     *
     * Expected format (from HTML prototype):
     * {
     *   "1": {
     *     "name": "Малый формат (до 350×500)",
     *     "steps": [{"minQty": 100, "price": 5500}, ...],
     *     "stepAfter3000": 1500
     *   },
     *   ...
     * }
     */
    @PostMapping("/import-print-tables")
    public ResponseEntity<Map<String, Object>> importPrintTables(@RequestBody Map<String, Object> json) {
        int imported = 0;
        int updated = 0;

        for (Map.Entry<String, Object> entry : json.entrySet()) {
            Integer formatId;
            try {
                formatId = Integer.parseInt(entry.getKey());
            } catch (NumberFormatException e) {
                continue;
            }

            Map<String, Object> data = (Map<String, Object>) entry.getValue();
            String name = (String) data.getOrDefault("name", "Формат " + formatId);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> steps = (List<Map<String, Object>>) data.getOrDefault("steps", Collections.emptyList());

            BigDecimal stepAfter3000 = new BigDecimal(
                    data.getOrDefault("stepAfter3000", 0).toString()
            );

            Optional<PrintTable> existing = printTableRepository.findByFormatId(formatId);

            if (existing.isPresent()) {
                PrintTable table = existing.get();
                table.setFormatName(name);
                table.setSteps(steps);
                table.setStepAfter3000(stepAfter3000);
                printTableRepository.save(table);
                updated++;
            } else {
                PrintTable table = new PrintTable();
                table.setFormatId(formatId);
                table.setFormatName(name);
                table.setSteps(steps);
                table.setStepAfter3000(stepAfter3000);
                printTableRepository.save(table);
                imported++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("imported", imported);
        result.put("updated", updated);
        result.put("total", json.size());
        return ResponseEntity.ok(result);
    }
}
