package com.korobki.calculator.service;

import com.korobki.core.config.PricingConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link KnifeCalculator}.
 * Verifies SVG parsing, scale detection (viewBox + width/height, default 96 DPI),
 * per-element length computation and the cost formula: lengthMm × pricePerMm + baseCost.
 */
class KnifeCalculatorTest {

    private static final double EPS = 1e-6;

    private PricingConfig pricingConfig;
    private KnifeCalculator calculator;

    @BeforeEach
    void setUp() {
        pricingConfig = new PricingConfig();
        pricingConfig.setKnifePricePerMm(new BigDecimal("3.0"));
        pricingConfig.setKnifeBaseCost(new BigDecimal("500.0"));
        calculator = new KnifeCalculator(pricingConfig);
    }

    /** SVG with an explicit 1:1 mm scale (viewBox 100×100, width/height 100mm). */
    private String svg1to1(String body) {
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" "
                + "width=\"100mm\" height=\"100mm\">" + body + "</svg>";
    }

    // --- Empty / invalid input ---

    @Test
    void nullContent_returnsZeroResult() {
        KnifeCalculator.KnifeResult r = calculator.calculate(null);

        assertEquals(0, r.getTotalLengthPx(), EPS);
        assertEquals(0, r.getTotalLengthMm(), EPS);
        assertEquals(0, r.getKnifeCost(), EPS);
        assertTrue(r.getDetails().isEmpty());
    }

    @Test
    void blankContent_returnsZeroResult() {
        KnifeCalculator.KnifeResult r = calculator.calculate("   ");

        assertEquals(0, r.getTotalLengthPx(), EPS);
        assertTrue(r.getDetails().isEmpty());
    }

    @Test
    void invalidXml_returnsZeroResult() {
        KnifeCalculator.KnifeResult r = calculator.calculate("<svg><line x1=\"0\"");

        assertEquals(0, r.getTotalLengthPx(), EPS);
        assertEquals(0, r.getKnifeCost(), EPS);
        assertTrue(r.getDetails().isEmpty());
    }

    // --- Scale detection ---

    @Test
    void explicitMmScale_isOne() {
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<line x1=\"0\" y1=\"0\" x2=\"10\" y2=\"0\"/>")
        );

        assertEquals(1.0, r.getScale(), EPS);
    }

    @Test
    void noDimensions_usesDefault96DpiScale() {
        // 1px = 0.264583mm
        KnifeCalculator.KnifeResult r = calculator.calculate(
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"0\" y1=\"0\" x2=\"100\" y2=\"0\"/></svg>"
        );

        assertEquals(0.264583, r.getScale(), EPS);
        assertEquals(100, r.getTotalLengthPx(), EPS);
        assertEquals(26.4583, r.getTotalLengthMm(), 1e-4);
    }

    @Test
    void cmUnits_convertedToMm() {
        // viewBox 100 wide, width 10cm = 100mm → scale 1
        KnifeCalculator.KnifeResult r = calculator.calculate(
                "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" "
                        + "width=\"10cm\" height=\"10cm\"><line x1=\"0\" y1=\"0\" x2=\"10\" y2=\"0\"/></svg>"
        );

        assertEquals(1.0, r.getScale(), EPS);
    }

    // --- Element lengths ---

    @Test
    void line_lengthIsEuclideanDistance() {
        // 3-4-5 triangle → 50
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<line x1=\"0\" y1=\"0\" x2=\"30\" y2=\"40\"/>")
        );

        assertEquals(50, r.getTotalLengthPx(), EPS);
        assertEquals(50, r.getTotalLengthMm(), EPS);
        assertEquals(1, r.getDetails().size());
        assertEquals("line", r.getDetails().get(0).getType());
    }

    @Test
    void rect_lengthIsPerimeter() {
        // 2*(10+20) = 60
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<rect width=\"10\" height=\"20\"/>")
        );

        assertEquals(60, r.getTotalLengthPx(), EPS);
    }

    @Test
    void circle_lengthIsCircumference() {
        // 2πr = 2π*10
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<circle r=\"10\"/>")
        );

        assertEquals(2 * Math.PI * 10, r.getTotalLengthPx(), 1e-6);
    }

    @Test
    void ellipse_lengthIsRamanujanApproximation() {
        // π*(3*(rx+ry) - sqrt((3rx+ry)*(rx+3ry))) for rx=10, ry=5
        double expected = Math.PI * (3 * (10 + 5) - Math.sqrt((3 * 10 + 5) * (10 + 3 * 5)));
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<ellipse rx=\"10\" ry=\"5\"/>")
        );

        assertEquals(expected, r.getTotalLengthPx(), 1e-6);
    }

    @Test
    void polyline_lengthIsSumOfSegments() {
        // (0,0)->(3,4)=5, (3,4)->(3,4)=0 → 5
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<polyline points=\"0,0 3,4 3,4\"/>")
        );

        assertEquals(5, r.getTotalLengthPx(), EPS);
    }

    @Test
    void path_singleLineSegment() {
        // M0 0 L30 40 → 50
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<path d=\"M0 0 L30 40\"/>")
        );

        assertEquals(50, r.getTotalLengthPx(), EPS);
    }

    @Test
    void unsupportedElement_isIgnored() {
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<text x=\"0\" y=\"0\">hi</text>")
        );

        assertEquals(0, r.getTotalLengthPx(), EPS);
        assertTrue(r.getDetails().isEmpty());
    }

    @Test
    void multipleElements_areSummed() {
        // line 50 + rect 60 = 110
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<line x1=\"0\" y1=\"0\" x2=\"30\" y2=\"40\"/><rect width=\"10\" height=\"20\"/>")
        );

        assertEquals(110, r.getTotalLengthPx(), EPS);
        assertEquals(2, r.getDetails().size());
    }

    // --- Cost formula ---

    @Test
    void cost_isLengthMmTimesPricePlusBase() {
        // 50mm * 3 + 500 = 650
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<line x1=\"0\" y1=\"0\" x2=\"30\" y2=\"40\"/>")
        );

        assertEquals(650, r.getKnifeCost(), EPS);
    }

    @Test
    void cost_usesConfiguredPricing() {
        pricingConfig.setKnifePricePerMm(new BigDecimal("2.0"));
        pricingConfig.setKnifeBaseCost(new BigDecimal("100.0"));

        // 50mm * 2 + 100 = 200
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<line x1=\"0\" y1=\"0\" x2=\"30\" y2=\"40\"/>")
        );

        assertEquals(200, r.getKnifeCost(), EPS);
    }

    @Test
    void emptySvg_noElements_costIsBaseOnly() {
        KnifeCalculator.KnifeResult r = calculator.calculate(svg1to1(""));

        assertEquals(0, r.getTotalLengthMm(), EPS);
        assertEquals(500, r.getKnifeCost(), EPS);
    }

    // --- Новый парсер: polygon, path-кривые, defs, единицы в атрибутах ---

    @Test
    void polygon_isSupportedAndClosed() {
        // 10 + 10 + √200 = 34.1421… (в старой версии polygon игнорировался)
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<polygon points=\"0,0 10,0 10,10\"/>")
        );

        assertEquals(34.14213562373095, r.getTotalLengthPx(), 1e-2);
        assertEquals("polygon", r.getDetails().get(0).getType());
    }

    @Test
    void pathCurvesAreMeasured() {
        // Q: 10(√2 + asinh 1) = 22.9558715…
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<path d=\"M0 0 Q10 10 20 0\"/>")
        );

        assertEquals(22.95587149392638, r.getTotalLengthPx(), 1e-2);
    }

    @Test
    void pathCloseZAddsClosingSegment() {
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<path d=\"M0 0 L10 0 L10 10 Z\"/>")
        );

        assertEquals(34.14213562373095, r.getTotalLengthPx(), 1e-2);
    }

    @Test
    void pathRelativeCommandsAreResolved() {
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<path d=\"m10 10 l20 0\"/>")
        );

        assertEquals(20, r.getTotalLengthPx(), EPS);
    }

    @Test
    void defsGeometryIsNotCounted() {
        KnifeCalculator.KnifeResult r = calculator.calculate(svg1to1(
                "<defs><line x1=\"0\" y1=\"0\" x2=\"100\" y2=\"0\"/></defs>"
                        + "<line x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"/>")
        );

        assertEquals(1, r.getTotalLengthPx(), EPS);
        assertEquals(1, r.getDetails().size());
    }

    @Test
    void elementAttributeUnitsAreConverted() {
        // viewBox 100, width 10cm → scale 1; line 10mm = 10 мм
        KnifeCalculator.KnifeResult r = calculator.calculate(
                "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" "
                        + "width=\"10cm\" height=\"10cm\">"
                        + "<line x1=\"0\" y1=\"0\" x2=\"10mm\" y2=\"0\"/></svg>"
        );

        assertEquals(10, r.getTotalLengthPx(), EPS);
        assertEquals(10, r.getTotalLengthMm(), EPS);
    }

    @Test
    void scaleSourceAndUnitAreExposed() {
        KnifeCalculator.KnifeResult r = calculator.calculate(
                svg1to1("<line x1=\"0\" y1=\"0\" x2=\"10\" y2=\"0\"/>")
        );

        assertEquals("width/height атрибуты", r.getScaleSource());
        assertEquals("mm", r.getUnit());
    }

    @Test
    void hasTransformFlagIsExposedPerElement() {
        KnifeCalculator.KnifeResult r = calculator.calculate(svg1to1(
                "<line x1=\"0\" y1=\"0\" x2=\"10\" y2=\"0\" transform=\"scale(2)\"/>")
        );

        assertEquals(20, r.getTotalLengthPx(), EPS);
        assertTrue(r.getDetails().get(0).isHasTransform());
    }

    // --- Флаги useTransform / useUnits ---

    @Test
    void useTransformFalse_ignoresTransform() {
        String svg = svg1to1("<g transform=\"scale(2)\">"
                + "<line x1=\"0\" y1=\"0\" x2=\"10\" y2=\"0\"/></g>");

        KnifeCalculator.KnifeResult withTransform = calculator.calculate(svg, true, true);
        KnifeCalculator.KnifeResult withoutTransform = calculator.calculate(svg, false, true);

        assertEquals(20, withTransform.getTotalLengthPx(), EPS);
        assertEquals(10, withoutTransform.getTotalLengthPx(), EPS);
    }

    @Test
    void useUnitsFalse_fallsBackToPlainNumbers() {
        // useUnits=true: viewBox 200 + width 100mm → масштаб 0.5 мм/ед.,
        //   «1cm» = 10 мм → 20 единиц → 10 мм
        // useUnits=false: width/height не читаются → viewBox как мм (масштаб 1),
        //   «1cm» = 1 единица → 1 мм (как parseFloat в прототипе)
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" "
                + "width=\"100mm\" height=\"100mm\">"
                + "<line x1=\"0\" y1=\"0\" x2=\"1cm\" y2=\"0\"/></svg>";

        KnifeCalculator.KnifeResult withUnits = calculator.calculate(svg, true, true);
        KnifeCalculator.KnifeResult withoutUnits = calculator.calculate(svg, true, false);

        assertEquals(10, withUnits.getTotalLengthMm(), EPS);
        assertEquals(1, withoutUnits.getTotalLengthMm(), EPS);
    }

    @Test
    void defaultOverloadUsesPrototypeFlags() {
        String svg = svg1to1("<line x1=\"0\" y1=\"0\" x2=\"10\" y2=\"0\" transform=\"scale(2)\"/>");

        assertEquals(calculator.calculate(svg, true, true).getTotalLengthPx(),
                calculator.calculate(svg).getTotalLengthPx(), EPS);
    }
}
