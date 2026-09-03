package com.korobki.api.controller;

import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.persistence.entity.PrintTable;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/print-tables")
@RequiredArgsConstructor
public class PrintTableController {

    private final PrintCostCalculator printCostCalculator;

    @GetMapping
    public List<PrintTable> getAllPrintTables() {
        return printCostCalculator.getAllPrintTables();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PrintTable> getPrintTableById(@PathVariable UUID id) {
        return ResponseEntity.ok(printCostCalculator.getPrintTableById(id));
    }

    @PostMapping
    public ResponseEntity<PrintTable> createPrintTable(@RequestBody PrintTable printTable) {
        // Если id пустой или невалидный, генерируем новый UUID
        if (printTable.getId() == null || printTable.getId().toString().isBlank()) {
            printTable.setId(null);
        }
        return ResponseEntity.ok(printCostCalculator.savePrintTable(printTable));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PrintTable> updatePrintTable(@PathVariable UUID id, @RequestBody PrintTable printTable) {
        return ResponseEntity.ok(printCostCalculator.updatePrintTable(id, printTable));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePrintTable(@PathVariable UUID id) {
        printCostCalculator.deletePrintTable(id);
        return ResponseEntity.ok().build();
    }
}
