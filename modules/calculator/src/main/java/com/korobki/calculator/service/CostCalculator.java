package com.korobki.calculator.service;

import com.korobki.core.config.PricingConfig;
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
 * Default workPrice comes from PricingConfig (application.yml).
 */
@Service
@RequiredArgsConstructor
public class CostCalculator {

    private final PrintCostCalculator printCostCalculator;
    private final PricingConfig pricingConfig;

    /**
     * Get the default work price per detail from configuration.
     *
     * @return default work price per detail (rubles)
     */
    public BigDecimal getDefaultWorkPrice() {
        return pricingConfig.getManufacturingCost();
    }

    /**
     * Calculate the total cost price for the given details, extras, and print settings.
     * Print cost is calculated per detail because each detail may have its own
     * number of parts per print sheet.
     *
     * @param details       list of detail DTOs (name, countOnSheet, sheetPrice, operations map)
     * @param extras        all operations (standard + custom) — cost per detail, looked up by name
     * @param printEnabled  whether print is enabled globally
     * @param printFormat   print format ID
     * @param printQuantity number of boxes in the print run
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
        return calculateTotalCost(
                details, extras, printEnabled, printFormat, printQuantity, workPrice, null);
    }

    /**
     * Same as {@link #calculateTotalCost(List, List, boolean, Integer, Integer, BigDecimal)}
     * plus the «Сборка на печатный лист» mode.
     *
     * <p>In assembly mode one sheet bill is shared by every detail placed on the
     * sheet, so each detail marked {@code inAssembly} gets the same per-part
     * print cost and the single-detail print flag is ignored.
     *
     * @param assemblyCostPerPart print cost of one detail in assembly mode
     *                            (rubles); null or 0 = the mode is off
     * @return total cost as BigDecimal (NOT yet rounded — caller decides)
     */
    public BigDecimal calculateTotalCost(
            List<DetailInfo> details,
            List<ExtraInfo> extras,
            boolean printEnabled,
            Integer printFormat,
            Integer printQuantity,
            BigDecimal workPrice,
            BigDecimal assemblyCostPerPart
    ) {
        BigDecimal sum = BigDecimal.ZERO;

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

            // Assembly mode: the sheet bill is shared by all details on the
            // sheet, so every detail in the assembly gets the same per-part cost.
            boolean inAssembly = assemblyCostPerPart != null
                    && assemblyCostPerPart.signum() > 0
                    && Boolean.TRUE.equals(d.getInAssembly());
            if (inAssembly) {
                cost = cost.add(assemblyCostPerPart);
            } else if (Boolean.TRUE.equals(d.getIsPrinted()) && printEnabled) {
                // Print: each printed detail gets its own per-unit print cost,
                // based on that detail's parts-per-sheet value.
                BigDecimal printPerUnit = printCostCalculator.calcPrintPerUnitNoVat(
                        printFormat, printQuantity, d.getPartsPerSheetOnPrint());
                cost = cost.add(printPerUnit);
            }

            sum = sum.add(cost);
        }

        return sum;
    }

    /**
     * Looks up the cost of an operation by name.
     *
     * @param extras all known operations
     * @param name   operation name to find
     * @return operation cost, or ZERO if not found
     */
    private BigDecimal findExtraCost(List<ExtraInfo> extras, String name) {
        return extras.stream()
                .filter(e -> name.equals(e.getName()))
                .map(e -> e.getCost() != null ? e.getCost() : BigDecimal.ZERO)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    // --- Inner DTOs for cost calculation (decoupled from API DTOs) ---

    /** Input data for a single detail (part) of the box. */
    public static class DetailInfo {
        private String name;
        private BigDecimal countOnSheet;
        private BigDecimal sheetPrice;
        private Boolean isPrinted;
        private Integer partsPerSheetOnPrint;
        private Boolean inAssembly;
        private Integer partsPerSheetInAssembly;
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
        public Integer getPartsPerSheetOnPrint() { return partsPerSheetOnPrint; }
        public void setPartsPerSheetOnPrint(Integer partsPerSheetOnPrint) { this.partsPerSheetOnPrint = partsPerSheetOnPrint; }
        public Boolean getInAssembly() { return inAssembly; }
        public void setInAssembly(Boolean inAssembly) { this.inAssembly = inAssembly; }
        public Integer getPartsPerSheetInAssembly() { return partsPerSheetInAssembly; }
        public void setPartsPerSheetInAssembly(Integer partsPerSheetInAssembly) { this.partsPerSheetInAssembly = partsPerSheetInAssembly; }
        public Boolean getEnabled() { return enabled; }
        public void setEnabled(Boolean enabled) { this.enabled = enabled; }
        public Boolean getIsCustom() { return isCustom; }
        public void setIsCustom(Boolean isCustom) { this.isCustom = isCustom; }
        public Map<String, Boolean> getOperations() { return operations; }
        public void setOperations(Map<String, Boolean> operations) { this.operations = operations; }
    }

    /** Input data for a single operation (extra) applied to details. */
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
