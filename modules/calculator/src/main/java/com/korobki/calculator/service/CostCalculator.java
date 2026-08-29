package com.korobki.calculator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * Calculator for total cost price of a box.
 * Sums up all enabled details (material + work + per-detail operations + print).
 *
 * Rounding: totalCost is rounded to integer (rounding #1).
 * All intermediate calculations use full BigDecimal precision.
 */
@Service
@RequiredArgsConstructor
public class CostCalculator {

    private final PrintCostCalculator printCostCalculator;

    /**
     * Calculate the total cost price for the given details, extras, and print settings.
     *
     * @param details       list of detail DTOs (name, countOnSheet, sheetPrice, operations map)
     * @param extras        all operations (standard + custom) — cost per detail, looked up by name
     * @param printEnabled  whether print is enabled globally
     * @param printFormat   print format ID
     * @param printQuantity print quantity
     * @param workPrice     work price per detail (global)
     * @return total cost as BigDecimal (NOT yet rounded — caller decides)
     */
    public BigDecimal calculateTotalCost(
            List<DetailInfo> details,
            List<ExtraInfo> extras,
            boolean printEnabled,
            Integer printFormat,
            Integer printQuantity,
            BigDecimal workPrice
    ) {
        BigDecimal sum = BigDecimal.ZERO;

        BigDecimal printPerUnit = BigDecimal.ZERO;
        if (printEnabled && printFormat != null && printQuantity != null) {
            printPerUnit = printCostCalculator.calcPrintPerUnitNoVat(printFormat, printQuantity);
        }

        for (DetailInfo d : details) {
            if (!Boolean.TRUE.equals(d.getEnabled()) || d.getCountOnSheet() == null
                    || d.getCountOnSheet().compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            // Material cost per part = sheetPrice / countOnSheet
            BigDecimal materialCost = d.getSheetPrice()
                    .divide(d.getCountOnSheet(), 10, RoundingMode.HALF_UP);

            // Work price per part
            BigDecimal cost = materialCost.add(workPrice);

            // All operations (standard + custom) via unified map
            if (d.getOperations() != null) {
                for (Map.Entry<String, Boolean> entry : d.getOperations().entrySet()) {
                    if (Boolean.TRUE.equals(entry.getValue())) {
                        BigDecimal opCost = findExtraCost(extras, entry.getKey());
                        cost = cost.add(opCost);
                    }
                }
            }

            // Print: each printed detail gets printPerUnit added
            if (Boolean.TRUE.equals(d.getIsPrinted()) && printEnabled) {
                cost = cost.add(printPerUnit);
            }

            sum = sum.add(cost);
        }

        return sum;
    }

    private BigDecimal findExtraCost(List<ExtraInfo> extras, String name) {
        return extras.stream()
                .filter(e -> name.equals(e.getName()))
                .map(e -> e.getCost() != null ? e.getCost() : BigDecimal.ZERO)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    // --- Inner DTOs for cost calculation (decoupled from API DTOs) ---

    public static class DetailInfo {
        private String name;
        private BigDecimal countOnSheet;
        private BigDecimal sheetPrice;
        private Boolean isPrinted;
        private Boolean enabled;
        private Boolean isCustom;
        private Map<String, Boolean> operations;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public BigDecimal getCountOnSheet() { return countOnSheet; }
        public void setCountOnSheet(BigDecimal countOnSheet) { this.countOnSheet = countOnSheet; }
        public BigDecimal getSheetPrice() { return sheetPrice; }
        public void setSheetPrice(BigDecimal sheetPrice) { this.sheetPrice = sheetPrice; }
        public Boolean getIsPrinted() { return isPrinted; }
        public void setIsPrinted(Boolean isPrinted) { this.isPrinted = isPrinted; }
        public Boolean getEnabled() { return enabled; }
        public void setEnabled(Boolean enabled) { this.enabled = enabled; }
        public Boolean getIsCustom() { return isCustom; }
        public void setIsCustom(Boolean isCustom) { this.isCustom = isCustom; }
        public Map<String, Boolean> getOperations() { return operations; }
        public void setOperations(Map<String, Boolean> operations) { this.operations = operations; }
    }

    public static class ExtraInfo {
        private String name;
        private BigDecimal cost;
        private Boolean enabled;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public BigDecimal getCost() { return cost; }
        public void setCost(BigDecimal cost) { this.cost = cost; }
        public Boolean getEnabled() { return enabled; }
        public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    }
}
