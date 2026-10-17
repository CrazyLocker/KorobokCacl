package com.korobki.core.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Configuration properties for pricing calculations.
 * All magic numbers from the HTML prototype are externalized here.
 * Placed in core module to avoid circular dependencies between pricing and calculator.
 */
@Component
@ConfigurationProperties(prefix = "app.pricing")
public class PricingConfig {

    /** Default cost of work per detail (rubles). */
    private BigDecimal manufacturingCost = new BigDecimal("5.0");
    /** Minimum margin added to cost when the "+N" branch wins (rubles). */
    private BigDecimal markupMin = new BigDecimal("30.0");
    /** Cost multiplier used by the "×3" branch. */
    private BigDecimal markupMultiplier = new BigDecimal("3.0");
    /** VAT rate applied after tier discounts (e.g. 0.11 = 11%). */
    private BigDecimal taxRate = new BigDecimal("0.11");
    // Defaults match the HTML prototype; overridden from application.yml
    /** Ruble correction per tier for the "+N" branch (negative = cheaper). */
    private Map<String, BigDecimal> discountSteps = defaultDiscountSteps();
    /** Multiplier per tier for the "×3" branch. */
    private Map<String, BigDecimal> x3Coefficients = defaultX3Coefficients();
    /** Knife cutting price per millimeter of cut length (rubles). */
    private BigDecimal knifePricePerMm = new BigDecimal("3.0");
    /** Knife base cost added regardless of cut length (rubles). */
    private BigDecimal knifeBaseCost = new BigDecimal("500.0");

    /**
     * Builds the default "+N" branch discount steps (rubles per tier).
     *
     * @return map of tier label to ruble correction
     */
    private static Map<String, BigDecimal> defaultDiscountSteps() {
        Map<String, BigDecimal> steps = new HashMap<>();
        steps.put("до 9", new BigDecimal("7"));
        steps.put("10–49", BigDecimal.ZERO);
        steps.put("50–199", new BigDecimal("-2"));
        steps.put("200–499", new BigDecimal("-4"));
        steps.put("500–699", new BigDecimal("-6"));
        steps.put("700–1499", new BigDecimal("-8"));
        steps.put("от 1500", new BigDecimal("-10"));
        return steps;
    }

    /**
     * Builds the default "×3" branch coefficients per tier.
     *
     * @return map of tier label to multiplier
     */
    private static Map<String, BigDecimal> defaultX3Coefficients() {
        Map<String, BigDecimal> coefficients = new HashMap<>();
        coefficients.put("до 9", new BigDecimal("1.0"));
        coefficients.put("10–49", new BigDecimal("1.0"));
        coefficients.put("50–199", new BigDecimal("0.95"));
        coefficients.put("200–499", new BigDecimal("0.90"));
        coefficients.put("500–699", new BigDecimal("0.85"));
        coefficients.put("700–1499", new BigDecimal("0.80"));
        coefficients.put("от 1500", new BigDecimal("0.75"));
        return coefficients;
    }

    public BigDecimal getManufacturingCost() {
        return manufacturingCost;
    }

    public void setManufacturingCost(BigDecimal manufacturingCost) {
        this.manufacturingCost = manufacturingCost;
    }

    public BigDecimal getMarkupMin() {
        return markupMin;
    }

    public void setMarkupMin(BigDecimal markupMin) {
        this.markupMin = markupMin;
    }

    public BigDecimal getMarkupMultiplier() {
        return markupMultiplier;
    }

    public void setMarkupMultiplier(BigDecimal markupMultiplier) {
        this.markupMultiplier = markupMultiplier;
    }

    public BigDecimal getTaxRate() {
        return taxRate;
    }

    public void setTaxRate(BigDecimal taxRate) {
        this.taxRate = taxRate;
    }

    public Map<String, BigDecimal> getDiscountSteps() {
        return discountSteps;
    }

    public void setDiscountSteps(Map<String, BigDecimal> discountSteps) {
        this.discountSteps = discountSteps;
    }

    public Map<String, BigDecimal> getX3Coefficients() {
        return x3Coefficients;
    }

    public void setX3Coefficients(Map<String, BigDecimal> x3Coefficients) {
        this.x3Coefficients = x3Coefficients;
    }

    public BigDecimal getKnifePricePerMm() {
        return knifePricePerMm;
    }

    public void setKnifePricePerMm(BigDecimal knifePricePerMm) {
        this.knifePricePerMm = knifePricePerMm;
    }

    public BigDecimal getKnifeBaseCost() {
        return knifeBaseCost;
    }

    public void setKnifeBaseCost(BigDecimal knifeBaseCost) {
        this.knifeBaseCost = knifeBaseCost;
    }
}
