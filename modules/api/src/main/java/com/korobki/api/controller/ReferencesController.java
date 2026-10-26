package com.korobki.api.controller;

import com.korobki.calculator.service.ConstructService;
import com.korobki.persistence.entity.Construct;
import com.korobki.persistence.entity.ConstructType;
import com.korobki.persistence.entity.Part;
import com.korobki.persistence.entity.PriceList;
import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.ConstructRepository;
import com.korobki.persistence.repository.PriceListRepository;
import com.korobki.persistence.repository.PrintTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

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
    private final ConstructService constructService;
    private final PriceListRepository priceListRepository;
    private final PrintTableRepository printTableRepository;

    /**
     * Import constructions from JSON.
     *
     * <p>New format:
     * <pre>
     * {
     *   "Конструкция1": {
     *     "description": "Описание",
     *     "type": "CUSTOM",
     *     "parts": [
     *       {"name": "Дно", "perSheet": 6, "pricePerSheet": 35}
     *     ]
     *   }
     * }
     * </pre>
     *
     * <p>The cardboard kind is no longer part of the model: the price of a
     * sheet ({@code pricePerSheet}) is the only material characteristic a
     * part carries. An optional {@code materialName} is ignored, and the
     * legacy format — where {@code parts} is an object
     * {@code {"Дно": 6, ...}} — imports those parts with a zero price,
     * because it has no price information at all.
     *
     * @param json import payload keyed by construction name
     * @return counts of imported and updated constructions
     */
    @PostMapping("/import-constructs")
    @Transactional
    public ResponseEntity<Map<String, Object>> importConstructs(@RequestBody Map<String, Object> json) {
        int imported = 0;
        int updated = 0;

        for (Map.Entry<String, Object> entry : json.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> rawData)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) rawData;
            String name = entry.getKey();
            List<Part> parts = parseParts(data);

            Construct existing = constructRepository.findAll().stream()
                    .filter(c -> c.getName().equals(name))
                    .findFirst()
                    .orElse(null);

            ConstructType type = parseType(data.get("type"));

            if (existing != null) {
                if (data.containsKey("description")) {
                    existing.setDescription(asString(data.get("description")));
                }
                if (type != null) {
                    existing.setType(type);
                }
                if (data.containsKey("parts")) {
                    constructService.replaceParts(existing, parts);
                } else {
                    constructRepository.save(existing);
                }
                updated++;
            } else {
                Construct construct = new Construct();
                construct.setName(name);
                construct.setDescription(asString(data.get("description")));
                construct.setType(type != null ? type : ConstructType.CUSTOM);
                construct.setIsActive(true);
                construct.setParts(parts);
                constructService.saveConstruct(construct);
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
     * Parses the {@code parts} block in both supported formats and reads
     * each part's sheet price.
     *
     * @param data construction payload
     * @return parts ready to be persisted
     */
    private List<Part> parseParts(Map<String, Object> data) {
        Object raw = data.get("parts");
        List<Part> parts = new ArrayList<>();

        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                String name = asString(map.get("name"));
                if (name == null || name.isBlank()) {
                    continue;
                }
                parts.add(buildPart(
                        name.trim(),
                        asInt(map.get("perSheet")),
                        asDecimal(map.get("pricePerSheet"))));
            }
        } else if (raw instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String name = asString(entry.getKey());
                if (name == null || name.isBlank()) {
                    continue;
                }
                parts.add(buildPart(name.trim(), asInt(entry.getValue()), null));
            }
        }
        return parts;
    }

    /**
     * Builds a part with its sheet price. The cardboard kind is not part of
     * the model, therefore an optional {@code materialName} from older
     * exports is ignored.
     *
     * @param name          detail name
     * @param perSheet      details per sheet
     * @param pricePerSheet sheet price; {@code null} becomes {@code 0}
     * @return part ready to be persisted
     */
    private Part buildPart(String name, int perSheet, BigDecimal pricePerSheet) {
        Part part = new Part();
        part.setName(name);
        part.setPerSheet(Math.max(perSheet, 0));
        part.setPricePerSheet(pricePerSheet != null ? pricePerSheet : BigDecimal.ZERO);
        return part;
    }

    /**
     * Parses an optional construction type.
     *
     * @param value raw JSON value
     * @return parsed type or {@code null} if absent/unknown
     */
    private ConstructType parseType(Object value) {
        if (value instanceof String text && !text.isBlank()) {
            try {
                return ConstructType.valueOf(text.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                // Unknown type — keep the default value.
            }
        }
        return null;
    }

    /**
     * Converts a raw JSON value to a string.
     *
     * @param value raw value
     * @return string value or {@code null}
     */
    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    /**
     * Converts a raw JSON value to an integer.
     *
     * @param value raw value
     * @return integer value, or {@code 0} if it cannot be parsed
     */
    private int asInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                // Fall through to the default value.
            }
        }
        return 0;
    }

    /**
     * Converts a raw JSON value to a decimal.
     *
     * @param value raw value
     * @return decimal value, or {@code null} if it cannot be parsed
     */
    private BigDecimal asDecimal(Object value) {
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return new BigDecimal(text.trim());
            } catch (NumberFormatException ignored) {
                // Fall through to the default value.
            }
        }
        return null;
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
     *
     * @param json import payload (direct map or "items" array format)
     * @return counts of imported and updated price lists
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
     *
     * @param json import payload keyed by numeric format id
     * @return counts of imported and updated print tables
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
