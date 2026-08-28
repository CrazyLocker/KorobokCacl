package com.korobki.api.controller;

import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.persistence.entity.PrintTable;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/print-tables")
@RequiredArgsConstructor
public class PrintTableController {

    private final PrintCostCalculator printCostCalculator;

    @GetMapping
    public List<PrintTable> getAllPrintTables() {
        return printCostCalculator.getAllPrintTables();
    }
}
