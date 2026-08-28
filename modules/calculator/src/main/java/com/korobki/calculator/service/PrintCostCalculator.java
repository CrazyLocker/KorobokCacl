package com.korobki.calculator.service;

import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.PrintTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * Calculator for print costs based on print_tables.
 * Handles step-based pricing with linear extrapolation above 3000.
 */
@Service
@RequiredArgsConstructor
public class PrintCostCalculator {

    private final PrintTableRepository printTableRepository;

    /**
     * Get all available print formats.
     */
    public List<PrintTable> getAllPrintTables() {
        return printTableRepository.findAllByOrderByFormatIdAsc();
    }

    /**
     * Calculate the total print cost for a given format and quantity.
     *
     * @param formatId print format (1, 2, or 3)
     * @param quantity print quantity
     * @return total cost for the print run, or ZERO if format not found
     */
    public BigDecimal calcPrintCost(Integer formatId, Integer quantity) {
        PrintTable table = printTableRepository.findByFormatId(formatId)
                .orElse(null);
        if (table == null || table.getSteps() == null || table.getSteps().isEmpty()) {
            return BigDecimal.ZERO;
        }

        List<Map<String, Object>> steps = table.getSteps();
        BigDecimal stepAfter3000 = table.getStepAfter3000();

        // If quantity >= 3000, use linear extrapolation
        if (quantity >= 3000) {
            BigDecimal price3000 = extractPrice(steps.get(steps.size() - 1));
            int extraThousands = (int) Math.ceil((quantity - 3000) / 1000.0);
            return price3000.add(stepAfter3000.multiply(BigDecimal.valueOf(extraThousands)));
        }

        // Find the first step where minQty >= quantity
        for (Map<String, Object> step : steps) {
            int minQty = extractInt(step.get("minQty"));
            if (minQty >= quantity) {
                return extractPrice(step);
            }
        }

        // If quantity is below the minimum step, return the first step's price
        return extractPrice(steps.get(0));
    }

    /**
     * Calculate print cost per unit (without VAT).
     */
    public BigDecimal calcPrintPerUnitNoVat(Integer formatId, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            return BigDecimal.ZERO;
        }
        return calcPrintCost(formatId, quantity)
                .divide(BigDecimal.valueOf(quantity), 10, RoundingMode.HALF_UP);
    }

    private BigDecimal extractPrice(Map<String, Object> step) {
        Object val = step.get("price");
        if (val instanceof Number) {
            return BigDecimal.valueOf(((Number) val).doubleValue());
        }
        return BigDecimal.ZERO;
    }

    private int extractInt(Object val) {
        if (val instanceof Number) {
            return ((Number) val).intValue();
        }
        return 0;
    }
}
