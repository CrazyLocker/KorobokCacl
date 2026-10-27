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
     * Get a print table by its id.
     */
    public PrintTable getPrintTableById(java.util.UUID id) {
        return printTableRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Print table not found with id: " + id));
    }

    /**
     * Save a new print table.
     */
    public PrintTable savePrintTable(PrintTable printTable) {
        return printTableRepository.save(printTable);
    }

    /**
     * Update an existing print table.
     */
    public PrintTable updatePrintTable(java.util.UUID id, PrintTable printTable) {
        PrintTable existing = getPrintTableById(id);
        existing.setFormatId(printTable.getFormatId());
        existing.setFormatName(printTable.getFormatName());
        existing.setSteps(printTable.getSteps());
        existing.setStepAfter3000(printTable.getStepAfter3000());
        return printTableRepository.save(existing);
    }

    /**
     * Delete a print table by its id.
     */
    public void deletePrintTable(java.util.UUID id) {
        printTableRepository.deleteById(id);
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
     * Calculate the print cost of one detail per box (without VAT).
     *
     * Mirrors the prototype formula:
     * <pre>
     *   rawSheets   = ceil(boxCount / partsPerSheetOnPrint)
     *   printBill   = calcPrintCost(formatId, rawSheets)
     *   printPerBox = (printBill / boxCount) / partsPerSheetOnPrint
     * </pre>
     *
     * The second division is intentional: one print sheet carries several
     * identical details, so the bill is shared between them.
     *
     * @param formatId              print format (1, 2, or 3)
     * @param boxCount              number of boxes in the print run
     * @param partsPerSheetOnPrint  details printed on one sheet; null/0 means 1
     * @return print cost per detail per box, or ZERO for invalid input or when
     *         there are more details on a sheet than boxes in the run
     */
    public BigDecimal calcPrintPerUnitNoVat(Integer formatId, Integer boxCount, Integer partsPerSheetOnPrint) {
        if (boxCount == null || boxCount <= 0) {
            return BigDecimal.ZERO;
        }

        int partsPerSheet = partsPerSheetOnPrint != null && partsPerSheetOnPrint > 0
                ? partsPerSheetOnPrint
                : 1;

        // The prototype blocks the calculation in this case; the calculator
        // itself must not produce a nonsensical negative/zero-sheet bill.
        if (partsPerSheet > boxCount) {
            return BigDecimal.ZERO;
        }

        int rawSheets = (boxCount + partsPerSheet - 1) / partsPerSheet;
        BigDecimal printBill = calcPrintCost(formatId, rawSheets);

        return printBill
                .divide(BigDecimal.valueOf(boxCount), 10, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(partsPerSheet), 10, RoundingMode.HALF_UP);
    }

    /**
     * Resolved assembly run: how many sheets are printed, which tariff step was
     * applied and what one sheet / one detail costs.
     *
     * @param sheets        sheets needed for the box run
     * @param tariffSheets  minQty of the tariff step the bill was taken from
     * @param bill          tariff price for the whole run
     * @param pricePerSheet bill / tariffSheets
     * @param pricePerPart  pricePerSheet / partsOnSheetTotal
     */
    public record AssemblyRun(int sheets, int tariffSheets, BigDecimal bill,
                              BigDecimal pricePerSheet, BigDecimal pricePerPart) {

        /** Empty run: the mode is off or the input is invalid. */
        public static AssemblyRun empty() {
            return new AssemblyRun(0, 0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    /**
     * Calculate the «Сборка на печатный лист» run (customer-approved formula).
     *
     * <p>One box is one complete set of details (1 bottom + 1 divider + 1 lid …),
     * so the box run equals the run of each detail. A sheet carries
     * {@code partsOnSheetTotal} parts, i.e. {@code partsOnSheetTotal /
     * detailCountInBox} complete sets:
     * <pre>
     *   sheets        = ceil(boxQuantity * detailCountInBox / partsOnSheetTotal)
     *   bill          = price of the first step with minQty >= sheets
     *                   (from 3000 — the last step plus stepAfter3000 per 1000)
     *   pricePerSheet = bill / tariffSheets                 // 7500 / 300 = 25
     *   pricePerPart  = pricePerSheet / partsOnSheetTotal   // 25 / 3 = 8.33
     * </pre>
     * The bill is shared by the details on the sheet only, so a box made of the
     * assembled details costs {@code pricePerPart * details in the box} (25 ₽ in
     * the example) — unlike the prototype the bill is NOT divided by the box run
     * a second time.
     *
     * @param formatId          print format (1, 2, or 3)
     * @param boxQuantity       box run (one box = one set of details)
     * @param partsOnSheetTotal details placed on one assembly sheet
     * @param detailCountInBox  details in one box (one complete set)
     * @return resolved run; {@link AssemblyRun#empty()} for invalid input or a
     *         missing print table
     */
    public AssemblyRun calcAssemblyRun(Integer formatId, Integer boxQuantity,
                                       Integer partsOnSheetTotal, Integer detailCountInBox) {
        if (formatId == null
                || boxQuantity == null || boxQuantity <= 0
                || partsOnSheetTotal == null || partsOnSheetTotal <= 0
                || detailCountInBox == null || detailCountInBox <= 0) {
            return AssemblyRun.empty();
        }

        PrintTable table = printTableRepository.findByFormatId(formatId).orElse(null);
        if (table == null || table.getSteps() == null || table.getSteps().isEmpty()) {
            return AssemblyRun.empty();
        }

        // sheets = ceil(boxQuantity / (partsOnSheetTotal / detailCountInBox)).
        // Integer math keeps fractional sets exact (2 parts on a sheet, 3 in a box).
        long numerator = (long) boxQuantity * detailCountInBox;
        int sheets = (int) ((numerator + partsOnSheetTotal - 1) / partsOnSheetTotal);

        List<Map<String, Object>> steps = table.getSteps();
        BigDecimal bill;
        int tariffSheets;
        if (sheets >= 3000) {
            // Same extrapolation rule as calcPrintCost().
            Map<String, Object> lastStep = steps.get(steps.size() - 1);
            BigDecimal stepAfter3000 = table.getStepAfter3000() != null
                    ? table.getStepAfter3000()
                    : BigDecimal.ZERO;
            int extraThousands = (int) Math.ceil((sheets - 3000) / 1000.0);
            bill = extractPrice(lastStep)
                    .add(stepAfter3000.multiply(BigDecimal.valueOf(extraThousands)));
            tariffSheets = extractInt(lastStep.get("minQty"));
        } else {
            // First step that covers the run; below the first step — the first step.
            Map<String, Object> chosen = steps.get(0);
            for (Map<String, Object> step : steps) {
                if (extractInt(step.get("minQty")) >= sheets) {
                    chosen = step;
                    break;
                }
            }
            bill = extractPrice(chosen);
            tariffSheets = extractInt(chosen.get("minQty"));
        }

        BigDecimal pricePerSheet = tariffSheets > 0
                ? bill.divide(BigDecimal.valueOf(tariffSheets), 10, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal pricePerPart = pricePerSheet.divide(
                BigDecimal.valueOf(partsOnSheetTotal), 10, RoundingMode.HALF_UP);

        return new AssemblyRun(sheets, tariffSheets, bill, pricePerSheet, pricePerPart);
    }

    /**
     * Print cost of one detail in the assembly mode (without VAT).
     *
     * @see #calcAssemblyRun(Integer, Integer, Integer, Integer)
     */
    public BigDecimal calcAssemblyPerPartNoVat(Integer formatId, Integer boxQuantity,
                                               Integer partsOnSheetTotal, Integer detailCountInBox) {
        return calcAssemblyRun(formatId, boxQuantity, partsOnSheetTotal, detailCountInBox)
                .pricePerPart();
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
