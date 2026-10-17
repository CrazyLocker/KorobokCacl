package com.korobki.api.controller;

import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.persistence.entity.PrintTable;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for printing price tables (CRUD).
 */
@RestController
@RequestMapping("/api/print-tables")
@RequiredArgsConstructor
public class PrintTableController {

    private final PrintCostCalculator printCostCalculator;

    /**
     * Returns all print tables ordered by format id.
     *
     * @return list of print tables
     */
    @GetMapping
    public List<PrintTable> getAllPrintTables() {
        return printCostCalculator.getAllPrintTables();
    }

    /**
     * Returns a print table by its identifier.
     *
     * @param id print table identifier
     * @return the print table
     */
    @GetMapping("/{id}")
    public ResponseEntity<PrintTable> getPrintTableById(@PathVariable UUID id) {
        return ResponseEntity.ok(printCostCalculator.getPrintTableById(id));
    }

    /**
     * Creates a print table. A blank id is replaced with a generated UUID.
     *
     * @param printTable print table to create
     * @return the created print table
     */
    @PostMapping
    public ResponseEntity<PrintTable> createPrintTable(@RequestBody PrintTable printTable) {
        // Если id пустой или невалидный, генерируем новый UUID
        if (printTable.getId() == null || printTable.getId().toString().isBlank()) {
            printTable.setId(null);
        }
        return ResponseEntity.ok(printCostCalculator.savePrintTable(printTable));
    }

    /**
     * Updates an existing print table.
     *
     * @param id         print table identifier
     * @param printTable new field values
     * @return the updated print table
     */
    @PutMapping("/{id}")
    public ResponseEntity<PrintTable> updatePrintTable(@PathVariable UUID id, @RequestBody PrintTable printTable) {
        return ResponseEntity.ok(printCostCalculator.updatePrintTable(id, printTable));
    }

    /**
     * Deletes a print table.
     *
     * @param id print table identifier
     * @return empty response
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePrintTable(@PathVariable UUID id) {
        printCostCalculator.deletePrintTable(id);
        return ResponseEntity.ok().build();
    }
}
