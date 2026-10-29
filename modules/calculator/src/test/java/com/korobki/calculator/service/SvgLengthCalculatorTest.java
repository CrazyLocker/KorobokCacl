package com.korobki.calculator.service;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Тесты геометрии SVG — порт раздела «Калькулятор ножа» из
 * {@code prototype/Расчет Заказа.html}.
 *
 * <p>Эталоны: аналитические значения (линии, прямоугольники, дуги, окружности)
 * и независимая численная интеграция Безье с шагом 1/200000 (в прототипе длину
 * кривых считал браузерный {@code getTotalLength()}, расхождение ≤ 0.01 ед.).
 */
class SvgLengthCalculatorTest {

    private static final double EPS = 1e-9;
    private static final double LEN_EPS = 0.01;

    private final SvgLengthCalculator calc = new SvgLengthCalculator();

    private static Element parse(String markup) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            Document doc = factory.newDocumentBuilder()
                    .parse(new InputSource(new StringReader(markup)));
            return doc.getDocumentElement();
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось разобрать тестовый SVG", e);
        }
    }

    private static Element first(Element root, String tag) {
        return (Element) root.getElementsByTagName(tag).item(0);
    }

    /** Независимый эталон длины кубической Безье: равномерная выборка, 200000 шагов. */
    private static double cubicReference(double x0, double y0, double x1, double y1,
                                         double x2, double y2, double x3, double y3) {
        int n = 200_000;
        double prevX = x0;
        double prevY = y0;
        double len = 0;
        for (int i = 1; i <= n; i++) {
            double t = (double) i / n;
            double mt = 1 - t;
            double x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
            double y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
            len += Math.hypot(x - prevX, y - prevY);
            prevX = x;
            prevY = y;
        }
        return len;
    }

    /** Эталон длины квадратичной Безье (через эквивалентную кубическую). */
    private static double quadReference(double x0, double y0, double qx, double qy,
                                        double x1, double y1) {
        return cubicReference(x0, y0,
                x0 + 2.0 / 3.0 * (qx - x0), y0 + 2.0 / 3.0 * (qy - y0),
                x1 + 2.0 / 3.0 * (qx - x1), y1 + 2.0 / 3.0 * (qy - y1),
                x1, y1);
    }

    // ============================================================
    // Матрицы
    // ============================================================

    @Test
    void parseTransform_nullIsIdentity() {
        assertArrayEquals(new double[]{1, 0, 0, 1, 0, 0}, calc.parseTransform(null), EPS);
        assertArrayEquals(new double[]{1, 0, 0, 1, 0, 0}, calc.parseTransform("  "), EPS);
    }

    @Test
    void parseTransform_translate() {
        assertArrayEquals(new double[]{1, 0, 0, 1, 10, 20},
                calc.parseTransform("translate(10, 20)"), EPS);
        assertArrayEquals(new double[]{1, 0, 0, 1, 10, 0},
                calc.parseTransform("translate(10)"), EPS);
    }

    @Test
    void parseTransform_scale() {
        assertArrayEquals(new double[]{2, 0, 0, 2, 0, 0}, calc.parseTransform("scale(2)"), EPS);
        assertArrayEquals(new double[]{2, 0, 0, 3, 0, 0}, calc.parseTransform("scale(2 3)"), EPS);
    }

    @Test
    void parseTransform_rotateAndSkew() {
        double[] rotate = calc.parseTransform("rotate(90)");
        assertEquals(0, rotate[0], 1e-12);
        assertEquals(1, rotate[1], 1e-12);
        assertEquals(-1, rotate[2], 1e-12);
        assertEquals(0, rotate[3], 1e-12);

        double[] skewX = calc.parseTransform("skewX(45)");
        assertEquals(1, skewX[2], 1e-12);
        double[] skewY = calc.parseTransform("skewY(45)");
        assertEquals(1, skewY[1], 1e-12);
    }

    @Test
    void parseTransform_rotateAroundCenterKeepsCenter() {
        double[] m = calc.parseTransform("rotate(90 10 10)");
        double[] center = calc.applyMatrix(m, 10, 10);
        assertEquals(10, center[0], 1e-9);
        assertEquals(10, center[1], 1e-9);
        // (20,10) → (10,20) при повороте на 90° вокруг (10,10)
        double[] p = calc.applyMatrix(m, 20, 10);
        assertEquals(10, p[0], 1e-9);
        assertEquals(20, p[1], 1e-9);
    }

    @Test
    void parseTransform_matrixAndComposition() {
        assertArrayEquals(new double[]{1, 2, 3, 4, 5, 6},
                calc.parseTransform("matrix(1,2,3,4,5,6)"), EPS);

        // translate(10,0) scale(2): точка (1,0) → (12,0)
        double[] m = calc.parseTransform("translate(10,0) scale(2)");
        double[] p = calc.applyMatrix(m, 1, 0);
        assertEquals(12, p[0], EPS);
        assertEquals(0, p[1], EPS);
    }

    @Test
    void multiplyMatrix_appliesRightToLeft() {
        double[] translate = {1, 0, 0, 1, 10, 0};
        double[] scale = {2, 0, 0, 2, 0, 0};
        double[] p = calc.applyMatrix(calc.multiplyMatrix(translate, scale), 1, 0);
        assertEquals(12, p[0], EPS);
    }

    // ============================================================
    // Единицы измерения
    // ============================================================

    @Test
    void parseLengthToMm_supportedUnits() {
        assertEquals(10, calc.parseLengthToMm("10mm"), EPS);
        assertEquals(100, calc.parseLengthToMm("10cm"), EPS);
        assertEquals(25.4, calc.parseLengthToMm("1in"), EPS);
        assertEquals(25.4 / 72, calc.parseLengthToMm("1pt"), EPS);
        assertEquals(25.4 / 6, calc.parseLengthToMm("1pc"), EPS);
        assertEquals(25.4 / 96, calc.parseLengthToMm("1px"), EPS);
        assertEquals(25.4 / 96 * 10, calc.parseLengthToMm("10"), EPS);
        assertEquals(12.5, calc.parseLengthToMm(" 12.5mm "), EPS);
    }

    @Test
    void parseLengthToMm_percentAndGarbageAreNull() {
        assertNull(calc.parseLengthToMm("50%"));
        assertNull(calc.parseLengthToMm("auto"));
        assertNull(calc.parseLengthToMm(""));
        assertNull(calc.parseLengthToMm(null));
    }

    // ============================================================
    // Масштаб документа
    // ============================================================

    @Test
    void detectScale_widthHeightInMm() {
        SvgLengthCalculator.ScaleInfo info = calc.detectScale(parse(
                "<svg viewBox=\"0 0 100 100\" width=\"100mm\" height=\"100mm\"/>"), true);

        assertEquals(1.0, info.scale(), EPS);
        assertEquals(100.0, info.widthMm(), EPS);
        assertEquals(100.0, info.heightMm(), EPS);
        assertEquals("width/height атрибуты", info.source());
        assertEquals("mm", info.unit());
    }

    @Test
    void detectScale_points() {
        SvgLengthCalculator.ScaleInfo info = calc.detectScale(parse(
                "<svg viewBox=\"0 0 100 100\" width=\"72pt\" height=\"72pt\"/>"), true);

        assertEquals(0.254, info.scale(), EPS);
        assertEquals("pt", info.unit());
    }

    @Test
    void detectScale_viewBoxOnlyActsAsMm() {
        SvgLengthCalculator.ScaleInfo info = calc.detectScale(parse(
                "<svg viewBox=\"0 0 200 100\"/>"), true);

        assertEquals(1.0, info.scale(), EPS);
        assertEquals(200.0, info.widthMm(), EPS);
        assertEquals("viewBox как мм", info.source());
        assertEquals("mm", info.unit());
    }

    @Test
    void detectScale_defaultsTo100x100Px() {
        SvgLengthCalculator.ScaleInfo info = calc.detectScale(parse("<svg/>"), true);

        assertEquals(0.2645833333, info.scale(), 1e-9);
        assertEquals("default 100×100 px", info.source());
        assertEquals("px", info.unit());
    }

    @Test
    void detectScale_withoutUnitsIgnoresWidthHeight() {
        SvgLengthCalculator.ScaleInfo info = calc.detectScale(parse(
                "<svg viewBox=\"0 0 100 100\" width=\"50mm\" height=\"50mm\"/>"), false);

        // useUnits=false: width/height не читаются → viewBox трактуется как мм
        assertEquals(1.0, info.scale(), EPS);
        assertEquals("viewBox как мм", info.source());
    }

    // ============================================================
    // path: M/L/H/V/Z
    // ============================================================

    @Test
    void path_nullOrBlankIsZero() {
        assertEquals(0, calc.pathLength(null, null), EPS);
        assertEquals(0, calc.pathLength("   ", null), EPS);
        assertEquals(0, calc.pathLength("", null), EPS);
    }

    @Test
    void path_absoluteLine() {
        assertEquals(10, calc.pathLength("M100 100 L110 100", null), EPS);
    }

    @Test
    void path_relativeMoveAndLine() {
        // m10 10 → (10,10); l20 0 → (30,10); длина 20
        assertEquals(20, calc.pathLength("m10 10 l20 0", null), EPS);
    }

    @Test
    void path_horizontalVerticalAndClose() {
        // квадрат 10×10: H10 → 10, V10 → 10, H0 → 10, Z → 10
        assertEquals(40, calc.pathLength("M0 0 H10 V10 H0 Z", null), EPS);
    }

    @Test
    void path_closeAddsSegmentToSubpathStart() {
        // 10 + 10 + √200 = 34.1421356…
        assertEquals(34.14213562373095, calc.pathLength("M0 0 L10 0 L10 10 Z", null), LEN_EPS);
    }

    @Test
    void path_implicitLineToAfterMove() {
        assertEquals(20, calc.pathLength("M0 0 10 0 20 0", null), EPS);
    }

    @Test
    void path_multipleSubpaths() {
        assertEquals(20, calc.pathLength("M0 0 L10 0 M100 0 L110 0", null), EPS);
    }

    @Test
    void path_compactSeparatorsAndNegativeNumbers() {
        assertEquals(20, calc.pathLength("M0,0L10,0L10,10", null), EPS);
        // «10-5» = 10 и −5
        assertEquals(Math.hypot(10, 5), calc.pathLength("M0 0L10-5", null), EPS);
        assertEquals(20, calc.pathLength("M0 0L10,0L10,10", null), EPS);
    }

    // ============================================================
    // path: кривые
    // ============================================================

    @Test
    void path_quadraticUsesExactCurveLength() {
        // ∫ 20√(1+(1−2t)²) dt = 10(√2 + asinh 1) = 22.9558715…
        assertEquals(22.95587149392638, calc.pathLength("M0 0 Q10 10 20 0", null), LEN_EPS);
    }

    @Test
    void path_quadraticSmoothReflectsControl() {
        // второй сегмент зеркален первому → та же длина
        assertEquals(2 * 22.95587149392638,
                calc.pathLength("M0 0 Q10 10 20 0 T40 0", null), LEN_EPS);
    }

    @Test
    void path_smoothTWithoutPreviousQuadIsLine() {
        // отражения нет → контрольная точка = текущая → прямая 20
        assertEquals(20, calc.pathLength("M0 0 T20 0", null), EPS);
    }

    @Test
    void path_cubicMatchesNumericReference() {
        double expected = cubicReference(0, 0, 10, 0, 10, 10, 20, 10);
        assertEquals(expected, calc.pathLength("M0 0 C10 0 10 10 20 10", null), LEN_EPS);
    }

    @Test
    void path_relativeCubicEqualsAbsolute() {
        double absolute = calc.pathLength("M0 0 C10 0 10 10 20 10", null);
        double relative = calc.pathLength("m0 0 c10 0 10 10 20 10", null);
        assertEquals(absolute, relative, LEN_EPS);
    }

    @Test
    void path_smoothCubicReflectsPreviousControl() {
        double first = cubicReference(0, 0, 10, 0, 10, 10, 20, 10);
        // отражение (10,10) относительно (20,10) → (30,10)
        double second = cubicReference(20, 10, 30, 10, 30, 20, 40, 10);
        assertEquals(first + second,
                calc.pathLength("M0 0 C10 0 10 10 20 10 S30 20 40 10", null), LEN_EPS);
    }

    @Test
    void path_arcSemicircle() {
        // радиус 10, полуокружность → π·10
        assertEquals(Math.PI * 10, calc.pathLength("M0 0 A10 10 0 0 1 20 0", null), LEN_EPS);
        assertEquals(Math.PI * 10, calc.pathLength("M0 0 A10 10 0 0 0 20 0", null), LEN_EPS);
        assertEquals(Math.PI * 5, calc.pathLength("M0 0 a5 5 0 0 1 10 0", null), LEN_EPS);
    }

    @Test
    void path_arcWithZeroRadiusIsLine() {
        assertEquals(10, calc.pathLength("M0 0 A0 0 0 0 1 10 0", null), EPS);
    }

    @Test
    void path_arcRotatedSemicircleHasSameLength() {
        // поворот эллипса на 90° не меняет длину полуокружности
        assertEquals(Math.PI * 10, calc.pathLength("M0 0 A10 10 90 0 1 20 0", null), LEN_EPS);
    }

    // ============================================================
    // Длины простых элементов
    // ============================================================

    @Test
    void polygon_closesContour() {
        Element polygon = first(parse("<svg><polygon points=\"0,0 10,0 10,10\"/></svg>"), "polygon");
        assertEquals(34.14213562373095, calc.getElementLength(polygon, false, 1), LEN_EPS);
    }

    @Test
    void polyline_doesNotClose() {
        Element polyline = first(parse("<svg><polyline points=\"0,0 10,0 10,10\"/></svg>"), "polyline");
        assertEquals(20, calc.getElementLength(polyline, false, 1), EPS);
    }

    @Test
    void polygon_withSinglePointIsZero() {
        Element polygon = first(parse("<svg><polygon points=\"0,0\"/></svg>"), "polygon");
        assertEquals(0, calc.getElementLength(polygon, false, 1), EPS);
    }

    @Test
    void rect_perimeter() {
        Element rect = first(parse("<svg><rect width=\"10\" height=\"20\"/></svg>"), "rect");
        assertEquals(60, calc.getElementLength(rect, false, 1), EPS);
    }

    @Test
    void circle_circumference() {
        Element circle = first(parse("<svg><circle r=\"10\"/></svg>"), "circle");
        assertEquals(2 * Math.PI * 10, calc.getElementLength(circle, false, 1), EPS);
    }

    @Test
    void ellipse_ramanujanFormulaUnchanged() {
        Element ellipse = first(parse("<svg><ellipse rx=\"10\" ry=\"5\"/></svg>"), "ellipse");
        double expected = Math.PI * (3 * (10 + 5) - Math.sqrt((3 * 10 + 5) * (10 + 3 * 5)));
        assertEquals(expected, calc.getElementLength(ellipse, false, 1), EPS);
    }

    @Test
    void elementAttributeUnitsAreConvertedWhenEnabled() {
        // viewBox 200 → width 100mm даёт масштаб 0.5 мм/ед.
        Element root = parse("<svg viewBox=\"0 0 200 200\" width=\"100mm\" height=\"100mm\">"
                + "<line x1=\"0\" y1=\"0\" x2=\"10mm\" y2=\"0\"/></svg>");
        double scale = calc.detectScale(root, true).scale();
        assertEquals(0.5, scale, EPS);

        Element line = first(root, "line");
        // 10 мм при масштабе 0.5 → 20 пользовательских единиц
        assertEquals(20, calc.getElementLength(line, true, scale), EPS);
        // без учёта единиц «10mm» читается как 10 единиц (поведение прототипа)
        assertEquals(10, calc.getElementLength(line, false, scale), EPS);
    }

    // ============================================================
    // Обход дерева и transform
    // ============================================================

    @Test
    void groupTransformScalesLine() {
        Element root = parse("<svg><g transform=\"scale(2)\"><line x2=\"10\"/></g></svg>");
        List<SvgLengthCalculator.ElementInfo> on = calc.collectElements(root, true, true, 1);
        assertEquals(1, on.size());
        assertEquals(20, on.get(0).lengthPx(), EPS);

        List<SvgLengthCalculator.ElementInfo> off = calc.collectElements(root, false, true, 1);
        assertEquals(10, off.get(0).lengthPx(), EPS);
    }

    @Test
    void nestedGroupTransformsMultiply() {
        Element root = parse("<svg><g transform=\"translate(5,0)\">"
                + "<g transform=\"scale(2)\"><line x2=\"10\"/></g></g></svg>");
        assertEquals(20, calc.collectElements(root, true, true, 1).get(0).lengthPx(), EPS);
    }

    @Test
    void rectTransformScalesPerimeter() {
        Element root = parse("<svg><rect width=\"10\" height=\"10\" transform=\"scale(2)\"/></svg>");
        assertEquals(80, calc.collectElements(root, true, true, 1).get(0).lengthPx(), EPS);
    }

    @Test
    void circleTransformScalesCircumference() {
        Element root = parse("<svg><circle r=\"10\" transform=\"scale(2)\"/></svg>");
        assertEquals(2 * Math.PI * 20, calc.collectElements(root, true, true, 1).get(0).lengthPx(), EPS);
    }

    @Test
    void pathTransformIsAppliedToCurve() {
        Element root = parse("<svg><path d=\"M0 0 L10 0\" transform=\"scale(3)\"/></svg>");
        assertEquals(30, calc.collectElements(root, true, true, 1).get(0).lengthPx(), EPS);
    }

    @Test
    void hasTransformFlagOnlyForOwnAttribute() {
        Element root = parse("<svg><g transform=\"scale(2)\">"
                + "<line x2=\"10\"/><line x2=\"5\" transform=\"scale(2)\"/></g></svg>");
        List<SvgLengthCalculator.ElementInfo> elements = calc.collectElements(root, true, true, 1);
        assertEquals(2, elements.size());
        assertFalse(elements.get(0).hasTransform());
        assertTrue(elements.get(1).hasTransform());
    }

    @Test
    void defsClipPathMaskSymbolMarkerPatternAreIgnored() {
        Element root = parse("<svg>"
                + "<defs><line x2=\"100\"/></defs>"
                + "<clipPath><line x2=\"100\"/></clipPath>"
                + "<mask><line x2=\"100\"/></mask>"
                + "<symbol><line x2=\"100\"/></symbol>"
                + "<marker><line x2=\"100\"/></marker>"
                + "<pattern><line x2=\"100\"/></pattern>"
                + "<line x2=\"1\"/>"
                + "</svg>");
        List<SvgLengthCalculator.ElementInfo> elements = calc.collectElements(root, true, true, 1);
        assertEquals(1, elements.size());
        assertEquals(1, elements.get(0).lengthPx(), EPS);
    }

    @Test
    void useElementIsNotSupported() {
        Element root = parse("<svg><defs><line id=\"a\" x2=\"10\"/></defs><use href=\"#a\"/></svg>");
        assertTrue(calc.collectElements(root, true, true, 1).isEmpty());
    }

    @Test
    void zeroLengthElementsAreSkipped() {
        Element root = parse("<svg><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"0\"/><line x2=\"5\"/></svg>");
        List<SvgLengthCalculator.ElementInfo> elements = calc.collectElements(root, true, true, 1);
        assertEquals(1, elements.size());
        assertEquals(5, elements.get(0).lengthPx(), EPS);
    }

    @Test
    void namespacePrefixedTagsAreRecognised() {
        Element root = parse("<svg><svg:line xmlns:svg=\"http://www.w3.org/2000/svg\" x2=\"7\"/></svg>");
        List<SvgLengthCalculator.ElementInfo> elements = calc.collectElements(root, true, true, 1);
        assertEquals(1, elements.size());
        assertEquals(7, elements.get(0).lengthPx(), EPS);
    }
}
