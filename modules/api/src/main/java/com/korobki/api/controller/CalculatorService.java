package com.korobki.api.controller;

import com.korobki.api.dto.*;
import com.korobki.calculator.service.CostCalculator;
import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.pricing.PriceCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Orchestrator service for the full calculation pipeline.
 *
 * Flow:
 * 1. Convert API DTOs → internal CostCalculator types
 * 2. Calculate total cost (CostCalculator)
 * 3. Round to integer (rounding #1)
 * 4. Generate price rows (PriceCalculator)
 * 5. Build response
 */
@Service
@RequiredArgsConstructor
public class CalculatorService {

    private final CostCalculator costCalculator;
    private final PriceCalculator priceCalculator;
    private final PrintCostCalculator printCostCalculator;

    /**
     * Runs the full calculation pipeline for a box.
     *
     * @param request calculation input (construction, details, extras, print settings, price list)
     * @return calculation result with total cost and per-tier client prices
     * @throws IllegalArgumentException on business-rule validation failure
     */
    @SuppressWarnings("deprecation") // legacy assembly response fields
    public CalculationResponse calculate(CalculationRequest request) {
        validate(request);

        // --- 1. Convert DTOs ---
        List<CostCalculator.DetailInfo> details = convertDetails(request.getDetails());
        List<CostCalculator.ExtraInfo> extras = convertExtras(request.getExtras());

        // Assembly mode is mutually exclusive with single-detail print, so the
        // isPrinted flags are ignored while assembly is on.
        boolean assemblyEnabled = request.getAssemblySettings() != null
                && Boolean.TRUE.equals(request.getAssemblySettings().getEnabled());
        boolean printEnabled = !assemblyEnabled
                && request.getPrintSettings() != null
                && Boolean.TRUE.equals(request.getPrintSettings().getEnabled());
        Integer printFormat = request.getPrintSettings() != null ? request.getPrintSettings().getFormat() : null;
        Integer printQuantity = request.getPrintSettings() != null ? request.getPrintSettings().getQuantity() : null;
        BigDecimal workPrice = request.getWorkPrice() != null ? request.getWorkPrice() : costCalculator.getDefaultWorkPrice();

        // --- 2. Reference print cost per unit for the response ---
        // Each detail can have its own parts-per-sheet value, so there is no
        // single per-unit value for the whole order. Keep the first active
        // printed detail here for backward compatibility; totalCost below uses
        // the correct per-detail value for every detail.
        BigDecimal printCostPerUnit = BigDecimal.ZERO;
        if (printEnabled && printFormat != null && printQuantity != null && printQuantity > 0) {
            for (CostCalculator.DetailInfo d : details) {
                if (Boolean.TRUE.equals(d.getEnabled())
                        && Boolean.TRUE.equals(d.getIsPrinted())
                        && d.getCountOnSheet() != null
                        && d.getCountOnSheet().compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal value = printCostCalculator.calcPrintPerUnitNoVat(
                            printFormat, printQuantity, d.getPartsPerSheetOnPrint());
                    printCostPerUnit = value != null ? value : BigDecimal.ZERO;
                    break;
                }
            }
        }

        // --- 2b. Assembly mode («Сборка на печатный лист») ---
        // One sheet carries the whole set of details, so the run is resolved
        // once for all of them: the number of sheets is driven by the detail
        // that needs the most sheets, and the bill is shared by every copy on
        // the sheet. The same per-part print cost is then added to every detail
        // marked for the assembly.
        Integer assemblyFormat = assemblyEnabled
                ? request.getAssemblySettings().getFormat()
                : null;
        Integer assemblyQuantity = assemblyEnabled
                ? request.getAssemblySettings().getQuantity()
                : null;
        PrintCostCalculator.AssemblyRun assemblyRun = assemblyEnabled
                ? printCostCalculator.calcAssemblyRun(
                        assemblyFormat, assemblyQuantity,
                        collectAssemblySheets(request.getDetails()))
                : null;

        // --- 3. Calculate total cost (full precision) ---
        BigDecimal totalCost = costCalculator.calculateTotalCost(
                details, extras, printEnabled, printFormat, printQuantity, workPrice,
                assemblyRun);

        // --- 4. Round to kopecks first, then to whole rubles (rounding #1) ---
        // Material is divided with scale=10, so values on a .5 boundary may be
        // represented as 92.4999999999. Rounding to kopecks first prevents an
        // off-by-one-ruble result.
        BigDecimal roundedCost = totalCost
                .setScale(2, RoundingMode.HALF_UP)
                .setScale(0, RoundingMode.HALF_UP);

        // --- 5. Generate prices (marginValue = "плечо" from request, if set) ---
        Map<String, BigDecimal> priceListMap = request.getPriceList();
        List<PriceCalculator.PriceRow> priceRows =
                priceCalculator.generatePrices(roundedCost, priceListMap, request.getMarginValue());

        // --- 6. Build response ---
        BigDecimal basePrice = priceCalculator.calcBasePrice(roundedCost, request.getMarginValue());
        String branch = priceCalculator.getBranch(roundedCost, request.getMarginValue());

        // Base price with VAT (for the base tier 10–49)
        BigDecimal basePriceWithVAT = basePrice.multiply(priceCalculator.getVatMultiplier())
                .setScale(0, RoundingMode.HALF_UP);

        List<PriceRowDto> priceRowDtos = new ArrayList<>();
        for (PriceCalculator.PriceRow row : priceRows) {
            PriceRowDto dto = new PriceRowDto();
            dto.setLabel(row.getLabel());
            dto.setWithoutVAT(row.getWithoutVAT());
            dto.setCalculatedPrice(row.getCalculatedPrice());
            dto.setPriceListPrice(row.getPriceListPrice());
            dto.setFinalPrice(row.getFinalPrice());
            dto.setIsBase(row.isBase());
            dto.setIsPriceListUsed(row.isPriceListUsed());
            priceRowDtos.add(dto);
        }

        CalculationResponse response = new CalculationResponse();
        response.setTotalCost(totalCost);
        response.setBasePrice(basePrice);
        response.setBranch(branch);
        response.setBasePriceWithVAT(basePriceWithVAT);
        response.setPrintCostPerUnit(printCostPerUnit);
        if (assemblyRun != null) {
            response.setAssemblyCostPerPart(assemblyRun.pricePerPart());
            response.setAssemblySheetCost(assemblyRun.pricePerSheet());
            response.setAssemblySheets(assemblyRun.sheets());
            response.setAssemblyPartsOnSheet(assemblyRun.totalPartsOnSheet());
            response.setDetails(buildDetailCosts(request.getDetails(), assemblyRun));
        }
        response.setPrices(priceRowDtos);

        return response;
    }

    /**
     * Converts API detail DTOs into internal cost-calculation types.
     *
     * @param dtos detail DTOs, may be null
     * @return list of internal detail info (never null)
     */
    private List<CostCalculator.DetailInfo> convertDetails(List<DetailDto> dtos) {
        if (dtos == null) return new ArrayList<>();
        return dtos.stream().map(dto -> {
            CostCalculator.DetailInfo info = new CostCalculator.DetailInfo();
            info.setName(dto.getName());
            info.setCountOnSheet(dto.getCountOnSheet());
            info.setSheetPrice(dto.getSheetPrice());
            info.setIsPrinted(dto.getIsPrinted());
            info.setPartsPerSheetOnPrint(dto.getPartsPerSheetOnPrint());
            info.setInAssembly(dto.getInAssembly());
            info.setEnabled(dto.getEnabled());
            info.setIsCustom(dto.getIsCustom());
            info.setOperations(dto.getOperations());
            return info;
        }).collect(Collectors.toList());
    }

    /**
     * Converts API extra DTOs into internal cost-calculation types.
     *
     * @param dtos extra DTOs, may be null
     * @return list of internal extra info (never null)
     */
    private List<CostCalculator.ExtraInfo> convertExtras(List<ExtraDto> dtos) {
        if (dtos == null) return new ArrayList<>();
        return dtos.stream().map(dto -> {
            CostCalculator.ExtraInfo info = new CostCalculator.ExtraInfo();
            info.setName(dto.getName());
            info.setCost(dto.getCost());
            info.setEnabled(dto.getEnabled());
            return info;
        }).collect(Collectors.toList());
    }

    /**
     * Business-rule validation beyond bean validation:
     * - enabled details must have countOnSheet > 0
     * - price list keys must be valid tier labels
     * - enabled print settings must have format and positive quantity
     * - assembly mode must have format, positive run quantity and at least one
     *   detail in the assembly
     * - a detail marked for the assembly must have colsOnSheet >= 1
     *   (null is a legacy payload and means 1 copy per sheet)
     * - assembly mode and single-detail print are mutually exclusive
     */
    private void validate(CalculationRequest request) {
        if (request.getDetails() != null) {
            for (int i = 0; i < request.getDetails().size(); i++) {
                DetailDto d = request.getDetails().get(i);
                if (Boolean.TRUE.equals(d.getEnabled())
                        && (d.getCountOnSheet() == null || d.getCountOnSheet().compareTo(BigDecimal.ZERO) <= 0)) {
                    throw new IllegalArgumentException(
                            "Detail '" + d.getName() + "' (index " + i + ") is enabled but countOnSheet must be > 0");
                }
                if (d.getSheetPrice() != null && d.getSheetPrice().compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException(
                            "Detail '" + d.getName() + "' (index " + i + ") sheetPrice must be >= 0");
                }

                // Assembly sheet: a checked detail must carry at least one copy
                // per sheet. Null is a legacy payload and means 1; an explicit
                // zero/negative value would silently drop the detail from the
                // sheet, so it is rejected instead.
                if (isInAssembly(d)
                        && d.getColsOnSheet() != null
                        && d.getColsOnSheet() < 1) {
                    throw new IllegalArgumentException(
                            "Detail '" + d.getName() + "' (index " + i
                                    + ") is in assembly but colsOnSheet must be >= 1");
                }

                // Prototype validatePrint(): active printed details must fit
                // into the detail run (parts per sheet <= quantity).
                PrintSettingsDto ps = request.getPrintSettings();
                boolean printIsEnabled = ps != null && Boolean.TRUE.equals(ps.getEnabled());
                if (printIsEnabled
                        && Boolean.TRUE.equals(d.getEnabled())
                        && Boolean.TRUE.equals(d.getIsPrinted())
                        && d.getCountOnSheet() != null
                        && d.getCountOnSheet().compareTo(BigDecimal.ZERO) > 0
                        && ps.getQuantity() != null
                        && ps.getQuantity() > 0) {
                    int partsPerSheet = d.getPartsPerSheetOnPrint() != null
                            && d.getPartsPerSheetOnPrint() > 0
                            ? d.getPartsPerSheetOnPrint()
                            : 1;
                    if (partsPerSheet > ps.getQuantity()) {
                        throw new IllegalArgumentException(
                                "Detail '" + d.getName() + "' (index " + i + ") has partsPerSheetOnPrint "
                                        + partsPerSheet + " greater than print quantity " + ps.getQuantity()
                                        + "; print calculation is blocked");
                    }
                }
            }
        }

        if (request.getPriceList() != null) {
            List<String> validLabels = PriceCalculator.tierLabels();
            for (String key : request.getPriceList().keySet()) {
                if (!validLabels.contains(key)) {
                    throw new IllegalArgumentException(
                            "Unknown price list tier '" + key + "'. Valid tiers: " + validLabels);
                }
            }
        }

        if (request.getPrintSettings() != null && Boolean.TRUE.equals(request.getPrintSettings().getEnabled())) {
            PrintSettingsDto ps = request.getPrintSettings();
            if (ps.getFormat() == null) {
                throw new IllegalArgumentException("Print settings enabled but format is missing");
            }
            if (ps.getQuantity() == null || ps.getQuantity() <= 0) {
                throw new IllegalArgumentException("Print settings enabled but quantity must be > 0");
            }
        }

        AssemblySettingsDto assembly = request.getAssemblySettings();
        if (assembly != null && Boolean.TRUE.equals(assembly.getEnabled())) {
            // Печать одной детали и сборка несовместимы: оба режима добавляют
            // стоимость печати одним и тем же деталям.
            if (request.getPrintSettings() != null
                    && Boolean.TRUE.equals(request.getPrintSettings().getEnabled())) {
                throw new IllegalArgumentException(
                        "Assembly mode and single-detail print are mutually exclusive: "
                                + "disable printSettings.enabled or assemblySettings.enabled");
            }
            if (assembly.getFormat() == null) {
                throw new IllegalArgumentException("Assembly settings enabled but format is missing");
            }
            if (assembly.getQuantity() == null || assembly.getQuantity() <= 0) {
                throw new IllegalArgumentException(
                        "Assembly settings enabled but quantity must be > 0");
            }
            boolean hasAssemblyDetails = request.getDetails() != null
                    && request.getDetails().stream().anyMatch(this::isInAssembly);
            if (!hasAssemblyDetails) {
                throw new IllegalArgumentException(
                        "Assembly settings enabled but no enabled detail is marked for assembly");
            }
        }
    }

    /** Whether the detail takes part in the assembly sheet. */
    private boolean isInAssembly(DetailDto d) {
        return Boolean.TRUE.equals(d.getEnabled())
                && Boolean.TRUE.equals(d.getInAssembly())
                && d.getCountOnSheet() != null
                && d.getCountOnSheet().signum() > 0;
    }

    /**
     * Details that take part in the assembly sheet, in request order.
     * Only enabled details with a positive material count can be printed.
     *
     * @param dtos request details, may be null
     * @return details for {@link PrintCostCalculator#calcAssemblyRun}
     */
    private List<PrintCostCalculator.DetailSheet> collectAssemblySheets(List<DetailDto> dtos) {
        List<PrintCostCalculator.DetailSheet> sheets = new ArrayList<>();
        if (dtos == null) {
            return sheets;
        }
        for (DetailDto d : dtos) {
            if (isInAssembly(d)) {
                sheets.add(new PrintCostCalculator.DetailSheet(d.getName(), d.getColsOnSheet()));
            }
        }
        return sheets;
    }

    /**
     * Per-detail print part of the assembly run for the response.
     *
     * <p>{@code detailId} is the index of the detail in the request
     * {@code details} list, so the client can match it without sending a
     * client-only row id to the backend.
     *
     * @param dtos request details, may be null
     * @param run  resolved assembly run, not null
     * @return one entry per request detail, in request order
     */
    private List<DetailCostDto> buildDetailCosts(List<DetailDto> dtos,
                                                 PrintCostCalculator.AssemblyRun run) {
        List<DetailCostDto> costs = new ArrayList<>();
        if (dtos == null) {
            return costs;
        }
        boolean runPriced = run != null && run.priced();
        for (int i = 0; i < dtos.size(); i++) {
            DetailDto d = dtos.get(i);
            boolean inAssembly = isInAssembly(d);
            int cols = d.getColsOnSheet() != null && d.getColsOnSheet() > 0
                    ? d.getColsOnSheet()
                    : 1;
            boolean blocked = inAssembly
                    && ((d.getColsOnSheet() != null && d.getColsOnSheet() < 1) || !runPriced);

            DetailCostDto cost = new DetailCostDto();
            cost.setDetailId(i);
            cost.setInAssembly(inAssembly);
            cost.setColsOnSheet(cols);
            cost.setSheets(inAssembly && !blocked ? run.sheets() : 0);
            cost.setPerPart(inAssembly && !blocked ? run.pricePerPart() : BigDecimal.ZERO);
            cost.setPrintBlocked(blocked);
            costs.add(cost);
        }
        return costs;
    }
}
