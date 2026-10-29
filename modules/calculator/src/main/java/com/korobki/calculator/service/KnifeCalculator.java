package com.korobki.calculator.service;

import com.korobki.core.config.PricingConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.xml.sax.ErrorHandler;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;

import javax.xml.XMLConstants;
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

    /** Ошибки разбора SVG не должны теряться: раньше они молча превращались в нули. */
    private static final Logger log = LoggerFactory.getLogger(KnifeCalculator.class);

    /** Xerces: не подгружать внешний DTD (svg11.dtd из выгрузок Illustrator/CorelDRAW). */
    private static final String LOAD_EXTERNAL_DTD =
            "http://apache.org/xml/features/nonvalidating/load-external-dtd";

    /** Xerces: DOCTYPE разрешён (с {@code true} файлы Illustrator падают ещё до разбора). */
    private static final String DISALLOW_DOCTYPE_DECL =
            "http://apache.org/xml/features/disallow-doctype-decl";

    /**
     * Ошибки разбора пробрасываются вызывающему коду, предупреждения только логируются
     * (иначе парсер печатает {@code [Fatal Error]} в stderr и дублирует наше сообщение).
     */
    private static final ErrorHandler THROWING_ERROR_HANDLER = new ErrorHandler() {
        @Override
        public void warning(SAXParseException exception) {
            log.debug("SVG parse warning: {}", exception.getMessage());
        }

        @Override
        public void error(SAXParseException exception) throws SAXException {
            throw exception;
        }

        @Override
        public void fatalError(SAXParseException exception) throws SAXException {
            throw exception;
        }
    };

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
        String normalized = normalizeSvg(svgContent);
        if (normalized.isEmpty()) {
            return emptyResult();
        }

        Document doc;
        try {
            doc = parseSvg(normalized);
        } catch (Exception e) {
            log.warn("SVG parse failed: {}", e.getMessage(), e);
            return parseErrorResult(describeParseError(e));
        }

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
                scaleInfo.source(), scaleInfo.unit(), details, null);
    }

    /**
     * Разбор SVG в DOM без загрузки внешних ресурсов.
     *
     * <p>Выгрузки Illustrator/CorelDRAW начинаются с
     * {@code <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "…/svg11.dtd">}.
     * {@link XMLConstants#FEATURE_SECURE_PROCESSING} запрещает доступ к внешнему DTD
     * ({@code accessExternalDTD=""}), поэтому парсер падал с {@code SAXParseException}
     * и расчёт молча возвращал нули. Теперь DOCTYPE разрешён, а внешний DTD и схемы
     * отдаются пустым потоком через {@link org.xml.sax.EntityResolver}: сеть и файлы
     * не читаются, XXE невозможен.
     *
     * @param svgContent уже нормализованный (без BOM и внешних пробелов) SVG
     * @return распарсенный документ
     * @throws Exception любая ошибка парсера — вызывающий код превращает её в parseError
     */
    private Document parseSvg(String svgContent) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setFeature(LOAD_EXTERNAL_DTD, false);
        factory.setFeature(DISALLOW_DOCTYPE_DECL, false);

        DocumentBuilder builder = factory.newDocumentBuilder();
        // Пустой DTD вместо svg11.dtd: DOCTYPE остаётся допустимым, но ничего не грузится.
        builder.setEntityResolver((publicId, systemId) -> new InputSource(new StringReader("")));
        builder.setErrorHandler(THROWING_ERROR_HANDLER);
        return builder.parse(new InputSource(new StringReader(svgContent)));
    }

    /**
     * BOM и внешние пробелы: файлы, сохранённые в Windows-редакторах, часто начинаются
     * с {@code \uFEFF}, из-за чего парсер падает с «Content is not allowed in prolog».
     */
    private static String normalizeSvg(String svgContent) {
        if (svgContent == null) {
            return "";
        }
        String normalized = svgContent;
        while (!normalized.isEmpty() && normalized.charAt(0) == '\uFEFF') {
            normalized = normalized.substring(1);
        }
        return normalized.strip();
    }

    /** Текст ошибки для UI: у {@link SAXParseException} добавляем позицию в документе. */
    private static String describeParseError(Exception e) {
        if (e instanceof SAXParseException sax) {
            return "строка " + sax.getLineNumber() + ", символ " + sax.getColumnNumber()
                    + ": " + sax.getMessage();
        }
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
    }

    /** Пустой/пробельный ввод: не ошибка разбора, просто нет геометрии. */
    private KnifeResult emptyResult() {
        return new KnifeResult(0, 0, 0, 0, null, null, new ArrayList<>(), null);
    }

    /** Разбор не удался: нули + описание ошибки, чтобы фронт показал причину, а не «0.00». */
    private KnifeResult parseErrorResult(String parseError) {
        return new KnifeResult(0, 0, 0, 0, null, null, new ArrayList<>(), parseError);
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
        private final String parseError;

        public KnifeResult(double totalLengthPx, double totalLengthMm, double knifeCost,
                           double scale, String scaleSource, String unit,
                           List<KnifeElementDto> details, String parseError) {
            this.totalLengthPx = totalLengthPx;
            this.totalLengthMm = totalLengthMm;
            this.knifeCost = knifeCost;
            this.scale = scale;
            this.scaleSource = scaleSource;
            this.unit = unit;
            this.details = details;
            this.parseError = parseError;
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

        /**
         * Описание ошибки разбора SVG ({@code null}, если разбор прошёл успешно).
         * Не {@code null} ⇒ длины нулевые, причина — битый XML; фронт показывает ошибку.
         */
        public String getParseError() { return parseError; }
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
