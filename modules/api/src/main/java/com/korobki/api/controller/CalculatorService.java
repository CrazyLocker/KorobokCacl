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
        // --- 1. Convert DTOs ---
        List<CostCalculator.DetailInfo> details = convertDetails(request.getDetails());
        List<CostCalculator.ExtraInfo> extras = convertExtras(request.getExtras());

        boolean printEnabled = request.getPrintSettings() != null
                && Boolean.TRUE.equals(request.getPrintSettings().getEnabled());
        Integer printFormat = request.getPrintSettings() != null ? request.getPrintSettings().getFormat() : null;
        Integer printQuantity = request.getPrintSettings() != null ? request.getPrintSettings().getQuantity() : null;
        BigDecimal workPrice = request.getWorkPrice() != null ? request.getWorkPrice() : BigDecimal.ZERO;

        // --- 2. Calculate total cost (full precision) ---
        BigDecimal totalCost = costCalculator.calculateTotalCost(
                details, extras, printEnabled, printFormat, printQuantity, workPrice);

        // --- 3. Round to integer (rounding #1) ---
        BigDecimal roundedCost = totalCost.setScale(0, RoundingMode.HALF_UP);

        // --- 4. Generate prices ---
        Map<String, BigDecimal> priceListMap = request.getPriceList();
        List<PriceCalculator.PriceRow> priceRows = priceCalculator.generatePrices(roundedCost, priceListMap);

        // --- 5. Build response ---
        BigDecimal basePrice = priceCalculator.calcBasePrice(roundedCost);
        String branch = priceCalculator.getBranch(roundedCost);

        // Base price with VAT (for the base tier 10–49)
        BigDecimal basePriceWithVAT = basePrice.multiply(PriceCalculator.VAT_MULTIPLIER)
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
}
