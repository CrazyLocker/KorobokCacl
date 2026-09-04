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

    public CalculationResponse calculate(CalculationRequest request) {
        validate(request);

        // --- 1. Convert DTOs ---
        List<CostCalculator.DetailInfo> details = convertDetails(request.getDetails());
        List<CostCalculator.ExtraInfo> extras = convertExtras(request.getExtras());

        boolean printEnabled = request.getPrintSettings() != null
                && Boolean.TRUE.equals(request.getPrintSettings().getEnabled());
        Integer printFormat = request.getPrintSettings() != null ? request.getPrintSettings().getFormat() : null;
        Integer printQuantity = request.getPrintSettings() != null ? request.getPrintSettings().getQuantity() : null;
        BigDecimal workPrice = request.getWorkPrice() != null ? request.getWorkPrice() : costCalculator.getDefaultWorkPrice();

        // --- 2. Calculate print cost per unit (before total cost, for response) ---
        BigDecimal printCostPerUnit = BigDecimal.ZERO;
        if (printEnabled && printFormat != null && printQuantity != null && printQuantity > 0) {
            printCostPerUnit = printCostCalculator.calcPrintPerUnitNoVat(printFormat, printQuantity);
        }

        // --- 3. Calculate total cost (full precision) ---
        BigDecimal totalCost = costCalculator.calculateTotalCost(
                details, extras, printEnabled, printFormat, printQuantity, workPrice);

        // --- 4. Round to integer (rounding #1) ---
        BigDecimal roundedCost = totalCost.setScale(0, RoundingMode.HALF_UP);

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
        response.setPrices(priceRowDtos);

        return response;
    }

    private List<CostCalculator.DetailInfo> convertDetails(List<DetailDto> dtos) {
        if (dtos == null) return new ArrayList<>();
        return dtos.stream().map(dto -> {
            CostCalculator.DetailInfo info = new CostCalculator.DetailInfo();
            info.setName(dto.getName());
            info.setCountOnSheet(dto.getCountOnSheet());
            info.setSheetPrice(dto.getSheetPrice());
            info.setIsPrinted(dto.getIsPrinted());
            info.setEnabled(dto.getEnabled());
            info.setIsCustom(dto.getIsCustom());
            info.setOperations(dto.getOperations());
            return info;
        }).collect(Collectors.toList());
    }

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
    }
}
