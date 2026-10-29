package com.korobki.calculator.service;

import com.korobki.core.config.PricingConfig;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Calculator for knife (die-cutting) cost.
 *
 * <p>Геометрия SVG (масштаб, transform, path, polygon, единицы) вынесена в
 * {@link SvgLengthCalculator} — порт 1:1 из раздела «5. КАЛЬКУЛЯТОР НОЖА
 * (ОБНОВЛЁННАЯ ВЕРСИЯ)» прототипа {@code prototype/Расчет Заказа.html}.
 * Формула стоимости не менялась: {@code lengthMm × knifePricePerMm + knifeBaseCost}.
 */
@Service
public class KnifeCalculator {

    private final PricingConfig pricingConfig;
    /** Геометрия SVG (без состояния, потокобезопасна). */
    private final SvgLengthCalculator svgLengthCalculator = new SvgLengthCalculator();

    /**
     * Creates a knife calculator with externalized pricing configuration.
     *
     * @param pricingConfig pricing configuration (price per mm, base cost)
     */
    public KnifeCalculator(PricingConfig pricingConfig) {
        this.pricingConfig = pricingConfig;
    }

    /**
     * Расчёт с режимом прототипа по умолчанию: transform и единицы учитываются.
     *
     * @param svgContent SVG file content as string
     * @return KnifeResult with total length, cost, scale info and element details
     */
    public KnifeResult calculate(String svgContent) {
        return calculate(svgContent, true, true);
    }

    /**
     * Calculate knife cost from SVG content.
     *
     * @param svgContent   SVG file content as string
     * @param useTransform учитывать transform (включая вложенные {@code <g>})
     * @param useUnits     учитывать единицы измерения (mm/cm/in/pt/pc/px)
     * @return KnifeResult with total length, cost, scale info and element details
     */
    public KnifeResult calculate(String svgContent, boolean useTransform, boolean useUnits) {
        if (svgContent == null || svgContent.trim().isEmpty()) {
            return emptyResult();
        }

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new InputSource(new StringReader(svgContent)));

            Element svgRoot = doc.getDocumentElement();
            SvgLengthCalculator.ScaleInfo scaleInfo = svgLengthCalculator.detectScale(svgRoot, useUnits);
            double scale = scaleInfo.scale();

            List<SvgLengthCalculator.ElementInfo> elements =
                    svgLengthCalculator.collectElements(svgRoot, useTransform, useUnits, scale);

            double totalLengthPx = 0;
            List<KnifeElementDto> details = new ArrayList<>();
            for (SvgLengthCalculator.ElementInfo info : elements) {
                totalLengthPx += info.lengthPx();
                details.add(new KnifeElementDto(
                        info.type(), info.lengthPx(), info.lengthPx() * scale, info.hasTransform()));
            }

            double totalLengthMm = totalLengthPx * scale;
            double knifeCost = totalLengthMm * pricingConfig.getKnifePricePerMm().doubleValue()
                    + pricingConfig.getKnifeBaseCost().doubleValue();

            return new KnifeResult(totalLengthPx, totalLengthMm, knifeCost, scale,
                    scaleInfo.source(), scaleInfo.unit(), details);

        } catch (Exception e) {
            // Return zero result on parse error
            return emptyResult();
        }
    }

    private KnifeResult emptyResult() {
        return new KnifeResult(0, 0, 0, 0, null, null, new ArrayList<>());
    }

    // --- Result DTO ---

    /** Immutable calculation result: lengths, cost, scale info and per-element breakdown. */
    public static class KnifeResult {
        private final double totalLengthPx;
        private final double totalLengthMm;
        private final double knifeCost;
        private final double scale;
        private final String scaleSource;
        private final String unit;
        private final List<KnifeElementDto> details;

        public KnifeResult(double totalLengthPx, double totalLengthMm, double knifeCost,
                           double scale, String scaleSource, String unit,
                           List<KnifeElementDto> details) {
            this.totalLengthPx = totalLengthPx;
            this.totalLengthMm = totalLengthMm;
            this.knifeCost = knifeCost;
            this.scale = scale;
            this.scaleSource = scaleSource;
            this.unit = unit;
            this.details = details;
        }

        public double getTotalLengthPx() { return totalLengthPx; }
        public double getTotalLengthMm() { return totalLengthMm; }
        public double getKnifeCost() { return knifeCost; }
        public double getScale() { return scale; }

        /** Источник масштаба (как в прототипе: 'width/height атрибуты', 'viewBox как мм' и т.д.). */
        public String getScaleSource() { return scaleSource; }

        /** Единица измерения корня: mm/cm/in/pt/pc/px. */
        public String getUnit() { return unit; }

        public List<KnifeElementDto> getDetails() { return details; }
    }

    /** Length of a single SVG element: px, mm and whether the element has its own transform. */
    public static class KnifeElementDto {
        private final String type;
        private final double lengthPx;
        private final double lengthMm;
        private final boolean hasTransform;

        public KnifeElementDto(String type, double lengthPx, double lengthMm, boolean hasTransform) {
            this.type = type;
            this.lengthPx = lengthPx;
            this.lengthMm = lengthMm;
            this.hasTransform = hasTransform;
        }

        public String getType() { return type; }
        public double getLengthPx() { return lengthPx; }
        public double getLengthMm() { return lengthMm; }

        /** Был ли у самого элемента атрибут {@code transform} (как {@code hasTransform} в прототипе). */
        public boolean isHasTransform() { return hasTransform; }
    }
}
