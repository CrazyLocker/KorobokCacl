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
        return tariffFor(table, quantity).bill();
    }

    /**
     * Resolves the tariff step for a print run: the first step with
     * {@code minQty >= sheets}, the first step for a run below the table and
     * linear extrapolation from 3000 sheets.
     */
    private Tariff tariffFor(PrintTable table, int sheets) {
        List<Map<String, Object>> steps = table.getSteps();

        // From 3000 sheets: the last step plus stepAfter3000 per started 1000.
        if (sheets >= 3000) {
            Map<String, Object> lastStep = steps.get(steps.size() - 1);
            BigDecimal stepAfter3000 = table.getStepAfter3000() != null
                    ? table.getStepAfter3000()
                    : BigDecimal.ZERO;
            int extraThousands = (int) Math.ceil((sheets - 3000) / 1000.0);
            return new Tariff(
                    extractInt(lastStep.get("minQty")),
                    extractPrice(lastStep).add(
                            stepAfter3000.multiply(BigDecimal.valueOf(extraThousands))));
        }

        // First step that covers the run; below the first step — the first step.
        Map<String, Object> chosen = steps.get(0);
        for (Map<String, Object> step : steps) {
            if (extractInt(step.get("minQty")) >= sheets) {
                chosen = step;
                break;
            }
        }
        return new Tariff(extractInt(chosen.get("minQty")), extractPrice(chosen));
    }

    /** A tariff step chosen for a print run. */
    private record Tariff(int tariffSheets, BigDecimal bill) {
    }

    /**
     * Calculate the print cost of one detail in the single-detail print mode
     * (without VAT), spread over the detail run.
     *
     * Mirrors the prototype formula:
     * <pre>
     *   rawSheets    = ceil(quantity / partsPerSheetOnPrint)
     *   printBill    = calcPrintCost(formatId, rawSheets)
     *   printPerUnit = (printBill / quantity) / partsPerSheetOnPrint
     * </pre>
     *
     * The second division is intentional: one print sheet carries several
     * identical details, so the bill is shared between them.
     *
     * @param formatId              print format (1, 2, or 3)
     * @param quantity              run of the detail
     * @param partsPerSheetOnPrint  details printed on one sheet; null/0 means 1
     * @return print cost per detail, or ZERO for invalid input or when there
     *         are more details on a sheet than details in the run
     */
    public BigDecimal calcPrintPerUnitNoVat(Integer formatId, Integer quantity, Integer partsPerSheetOnPrint) {
        if (quantity == null || quantity <= 0) {
            return BigDecimal.ZERO;
        }

        int partsPerSheet = partsPerSheetOnPrint != null && partsPerSheetOnPrint > 0
                ? partsPerSheetOnPrint
                : 1;

        // The prototype blocks the calculation in this case; the calculator
        // itself must not produce a nonsensical negative/zero-sheet bill.
        if (partsPerSheet > quantity) {
            return BigDecimal.ZERO;
        }

        int rawSheets = ceilDiv(quantity, partsPerSheet);
        BigDecimal printBill = calcPrintCost(formatId, rawSheets);

        return printBill
                .divide(BigDecimal.valueOf(quantity), 10, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(partsPerSheet), 10, RoundingMode.HALF_UP);
    }

    /**
     * A detail placed on the assembly sheet.
     *
     * @param name        detail name (used for diagnostics only)
     * @param colsOnSheet copies of this detail on one assembly sheet;
     *                    null = 1 (legacy payloads), less than 1 = invalid
     */
    public record DetailSheet(String name, Integer colsOnSheet) {

        /** Copies on one sheet with null treated as 1 (legacy payloads). */
        public int resolvedColsOnSheet() {
            return colsOnSheet != null ? colsOnSheet : 1;
        }
    }

    /**
     * Resolved assembly run for the whole set of details on one sheet.
     *
     * @param sheets            sheets printed for the run:
     *                          {@code max(ceil(quantity / colsOnSheet_j))}
     * @param tariffSheets      minQty of the tariff step the bill was taken from
     * @param bill              tariff price for the whole run
     * @param pricePerSheet     bill / sheets — what one printed sheet costs
     * @param pricePerPart      (bill / sheets) / totalPartsOnSheet — print cost
     *                          of one copy of any detail in the set
     * @param totalPartsOnSheet sum of {@code colsOnSheet} over the details on the sheet
     */
    public record AssemblyRun(int sheets, int tariffSheets, BigDecimal bill,
                              BigDecimal pricePerSheet, BigDecimal pricePerPart,
                              int totalPartsOnSheet) {

        /** Empty run: the mode is off, the input is invalid or there is no tariff. */
        public static AssemblyRun empty() {
            return new AssemblyRun(0, 0, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, 0);
        }

        /** Whether the run has at least one sheet and a printable bill. */
        public boolean priced() {
            return sheets > 0 && bill != null && bill.signum() > 0;
        }
    }

    /**
     * Calculates the «Сборка на печатный лист» run for the whole set of details
     * placed on one assembly sheet.
     *
     * <p>One sheet carries a complete set of details: a detail with
     * {@code colsOnSheet = 3} appears three times on every sheet. The run must
     * print enough sheets for every detail, so it is driven by the detail that
     * needs the most sheets:
     * <pre>
     *   totalPartsOnSheet = Σ colsOnSheet_j
     *   sheets            = max(ceil(quantity / colsOnSheet_j))
     *   bill              = calcPrintCost(formatId, sheets)
     *   pricePerSheet     = bill / sheets
     *   pricePerPart      = pricePerSheet / totalPartsOnSheet
     * </pre>
     * {@code pricePerPart} is the same for every detail in the set: one sheet
     * bill is shared by all copies printed on it. {@code quantity} is the run
     * of each detail (one box = one complete set), so it replaces the old
     * box-count based formula.
     *
     * <p>A detail with {@code colsOnSheet < 1} cannot be placed on the sheet and
     * is skipped here. {@code CalculatorService} rejects such a request with a
     * validation error, so silently skipping can never hide a user mistake in
     * the API path; skipping instead of failing the whole run keeps this method
     * total and lets the caller report a precise per-detail error.
     *
     * @param formatId print format (1, 2, or 3)
     * @param quantity run of each detail (number of complete sets)
     * @param details  details placed on the sheet
     * @return resolved run; {@link AssemblyRun#empty()} when the input is
     *         invalid, nothing can be placed on the sheet, the print table is
     *         missing or the tariff bill is zero
     */
    public AssemblyRun calcAssemblyRun(Integer formatId, Integer quantity,
                                       List<DetailSheet> details) {
        if (formatId == null || quantity == null || quantity <= 0
                || details == null || details.isEmpty()) {
            return AssemblyRun.empty();
        }

        int totalPartsOnSheet = 0;
        int sheets = 0;
        for (DetailSheet detail : details) {
            if (detail == null) {
                continue;
            }
            int cols = detail.resolvedColsOnSheet();
            if (cols < 1) {
                // Rejected by CalculatorService validation; skip defensively.
                continue;
            }
            totalPartsOnSheet += cols;
            sheets = Math.max(sheets, ceilDiv(quantity, cols));
        }
        if (totalPartsOnSheet == 0 || sheets == 0) {
            return AssemblyRun.empty();
        }

        PrintTable table = printTableRepository.findByFormatId(formatId).orElse(null);
        if (table == null || table.getSteps() == null || table.getSteps().isEmpty()) {
            return AssemblyRun.empty();
        }

        Tariff tariff = tariffFor(table, sheets);
        if (tariff.bill().signum() <= 0) {
            return AssemblyRun.empty();
        }

        BigDecimal pricePerSheet = tariff.bill()
                .divide(BigDecimal.valueOf(sheets), 10, RoundingMode.HALF_UP);
        BigDecimal pricePerPart = pricePerSheet
                .divide(BigDecimal.valueOf(totalPartsOnSheet), 10, RoundingMode.HALF_UP);

        return new AssemblyRun(sheets, tariff.tariffSheets(), tariff.bill(),
                pricePerSheet, pricePerPart, totalPartsOnSheet);
    }

    /** Integer ceiling division for positive operands. */
    private static int ceilDiv(int dividend, int divisor) {
        return (dividend + divisor - 1) / divisor;
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
