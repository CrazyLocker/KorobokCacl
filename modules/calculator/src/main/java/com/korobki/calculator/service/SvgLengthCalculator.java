// modules/calculator/src/main/java/com/korobki/calculator/service/SvgLengthCalculator.java
package com.korobki.calculator.service;

import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Геометрия SVG для расчёта длины ножа.
 *
 * <p>Порт 1:1 из {@code prototype/Расчет Заказа.html}, раздел
 * «5. КАЛЬКУЛЯТОР НОЖА (ОБНОВЛЁННАЯ ВЕРСИЯ)»: {@code parseLengthToMm},
 * {@code detectScale}, {@code parseTransform}, {@code multiplyMatrix},
 * {@code applyMatrix}, {@code getElementLength},
 * {@code getElementLengthWithTransform}, {@code collectElements},
 * {@code ellipsePerimeter}.
 *
 * <p>Отличия от прототипа (осознанные):
 * <ul>
 *   <li>{@code path} не измеряется браузерным {@code getTotalLength()}, а
 *       разворачивается в отрезки с допуском {@code 0.001} ед.;</li>
 *   <li>при {@code useUnits = true} единицы поддерживаются не только у
 *       {@code width}/{@code height} корня, но и у геометрических атрибутов
 *       ({@code <rect width="10mm">}): значение переводится в мм и обратно в
 *       пользовательские единицы по масштабу документа;</li>
 *   <li>префикс пространства имён нормализуется ({@code svg:line} → {@code line}).</li>
 * </ul>
 *
 * <p>Класс без состояния, можно переиспользовать.
 */
public class SvgLengthCalculator {

    /** CSS-пикселей в миллиметре при 96 DPI (как {@code PX_TO_MM} в прототипе). */
    public static final double PX_TO_MM = 25.4 / 96.0;

    /** Единичная матрица SVG: {@code [a, b, c, d, e, f]}. */
    public static final double[] IDENTITY = {1, 0, 0, 1, 0, 0};

    /** Контейнеры, геометрия которых не относится к контуру ножа. */
    private static final Set<String> IGNORED_TAGS =
            Set.of("defs", "clippath", "mask", "symbol", "marker", "pattern");

    /** Теги, дающие длину реза (как {@code RELEVANT_TAGS} в прототипе). */
    private static final Set<String> RELEVANT_TAGS =
            Set.of("line", "rect", "circle", "ellipse", "polyline", "polygon", "path");

    /** Допуск разворачивания кривых в отрезки, в пользовательских единицах. */
    private static final double FLAT_TOLERANCE = 0.001;

    /** Ограничение глубины рекурсии при разворачивании Безье. */
    private static final int MAX_SUBDIVISION_DEPTH = 12;

    private static final Pattern LENGTH_PATTERN = Pattern.compile(
            "^([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*([a-z%]*)$", Pattern.CASE_INSENSITIVE);

    private static final Pattern TRANSFORM_PATTERN = Pattern.compile(
            "(matrix|translate|scale|rotate|skewX|skewY)\\s*\\(([^)]*)\\)", Pattern.CASE_INSENSITIVE);

    private static final Pattern PATH_TOKEN_PATTERN = Pattern.compile(
            "([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)");

    private static final Pattern LEADING_NUMBER_PATTERN = Pattern.compile(
            "^\\s*([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)");

    private static final Pattern NUMBER_PATTERN = Pattern.compile(
            "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?");

    /**
     * Результат {@link #detectScale}: масштаб «мм на пользовательскую единицу».
     *
     * @param scale    мм на единицу
     * @param widthMm  ширина документа в мм (может быть null)
     * @param heightMm высота документа в мм (может быть null)
     * @param viewBox  {@code [x, y, w, h]} либо null
     * @param source   источник масштаба (как в прототипе: 'width/height атрибуты' и т.д.)
     * @param unit     единица измерения корня: mm/cm/in/pt/pc/px
     */
    public record ScaleInfo(double scale, Double widthMm, Double heightMm,
                            double[] viewBox, String source, String unit) {
    }

    /** Длина одного элемента контура. */
    public record ElementInfo(String type, double lengthPx, boolean hasTransform) {
    }

    // ============================================================
    // Длины и единицы
    // ============================================================

    /**
     * Перевод длины из SVG-строки в миллиметры (порт {@code parseLengthToMm}).
     * Без единицы значение трактуется как px (0.264583 мм). {@code '%'} и
     * прочие единицы → {@code null}.
     */
    public Double parseLengthToMm(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        Matcher m = LENGTH_PATTERN.matcher(value.trim());
        if (!m.matches()) {
            return null;
        }
        double num;
        try {
            num = Double.parseDouble(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
        if (!Double.isFinite(num)) {
            return null;
        }
        String unit = m.group(2) == null ? "" : m.group(2).toLowerCase();
        return switch (unit) {
            case "mm" -> num;
            case "cm" -> num * 10;
            case "in" -> num * 25.4;
            case "pt" -> num * 25.4 / 72;
            case "pc" -> num * 25.4 / 6;
            case "px", "" -> num * PX_TO_MM;
            default -> null;
        };
    }

    /** Явно ли указана единица измерения: {@code "10mm"} → true, {@code "10"} → false. */
    public boolean hasExplicitUnit(String value) {
        if (value == null) {
            return false;
        }
        Matcher m = LENGTH_PATTERN.matcher(value.trim());
        return m.matches() && m.group(2) != null && !m.group(2).isEmpty();
    }

    /** Аналог JS {@code parseFloat}: ведущее число строки либо {@code null}. */
    public Double parseFloatLike(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        Matcher m = LEADING_NUMBER_PATTERN.matcher(value.trim());
        if (!m.find()) {
            return null;
        }
        double num = Double.parseDouble(m.group(1));
        return Double.isFinite(num) ? num : null;
    }

    /** Единица измерения строки длины; {@code px} для значения без единицы. */
    private String unitOf(String value) {
        if (value == null) {
            return "px";
        }
        Matcher m = LENGTH_PATTERN.matcher(value.trim());
        if (!m.matches() || m.group(2) == null || m.group(2).isEmpty()) {
            return "px";
        }
        return m.group(2).toLowerCase();
    }

    // ============================================================
    // Масштаб документа
    // ============================================================

    /**
     * Определение масштаба «мм на пользовательскую единицу» (порт {@code detectScale}).
     *
     * <p>Порядок: {@code width}/{@code height} в единицах → {@code viewBox} как мм →
     * 100×100 px по умолчанию; масштаб — среднее по осям, если известны обе стороны.
     */
    public ScaleInfo detectScale(Element svg, boolean useUnits) {
        double[] vb = null;
        String viewBox = attr(svg, "viewBox");
        if (viewBox != null && !viewBox.isBlank()) {
            String[] parts = viewBox.trim().split("\\s+");
            if (parts.length == 4) {
                double[] nums = new double[4];
                boolean ok = true;
                for (int i = 0; i < 4; i++) {
                    Double parsed = parseFloatLike(parts[i]);
                    if (parsed == null) {
                        ok = false;
                        break;
                    }
                    nums[i] = parsed;
                }
                if (ok) {
                    vb = nums;
                }
            }
        }

        String widthAttr = attr(svg, "width");
        String heightAttr = attr(svg, "height");

        Double widthMm = null;
        Double heightMm = null;
        String source = "default (px→mm)";
        String unit = "px";

        if (useUnits) {
            widthMm = parseLengthToMm(widthAttr);
            heightMm = parseLengthToMm(heightAttr);
            if (widthMm != null || heightMm != null) {
                source = "width/height атрибуты";
            }
        }
        if (widthMm != null || heightMm != null) {
            unit = unitOf(widthMm != null ? widthAttr : heightAttr);
        }

        if (vb != null) {
            if (widthMm == null && heightMm == null) {
                widthMm = vb[2];
                heightMm = vb[3];
                source = "viewBox как мм";
                unit = "mm";
            } else if (widthMm == null && vb[3] > 0) {
                widthMm = heightMm * (vb[2] / vb[3]);
            } else if (heightMm == null && vb[2] > 0) {
                heightMm = widthMm * (vb[3] / vb[2]);
            }
        } else if (widthMm == null && heightMm == null) {
            widthMm = 100 * PX_TO_MM;
            heightMm = 100 * PX_TO_MM;
            source = "default 100×100 px";
            unit = "px";
        }

        double scale;
        if (vb != null && vb[2] > 0 && vb[3] > 0 && truthy(widthMm) && truthy(heightMm)) {
            double scaleX = widthMm / vb[2];
            double scaleY = heightMm / vb[3];
            scale = (scaleX + scaleY) / 2;
        } else if (truthy(widthMm) && vb != null && vb[2] > 0) {
            scale = widthMm / vb[2];
        } else if (truthy(widthMm) && vb == null) {
            Double widthPx = parseFloatLike(widthAttr);
            scale = widthMm / (widthPx == null || widthPx == 0 ? 100.0 : widthPx);
        } else {
            scale = PX_TO_MM;
        }

        return new ScaleInfo(scale, widthMm, heightMm, vb, source, unit);
    }

    /** JS-«истинность» числа: 0 и null считаются ложью (как в прототипе). */
    private static boolean truthy(Double value) {
        return value != null && value != 0;
    }

    // ============================================================
    // Матрицы (порт multiplyMatrix / applyMatrix / parseTransform)
    // ============================================================

    /** Разбор {@code transform="..."} в матрицу {@code [a,b,c,d,e,f]}. */
    public double[] parseTransform(String transformStr) {
        double[] m = IDENTITY.clone();
        if (transformStr == null || transformStr.isBlank()) {
            return m;
        }
        Matcher matcher = TRANSFORM_PATTERN.matcher(transformStr);
        while (matcher.find()) {
            String type = matcher.group(1).toLowerCase();
            List<Double> args = numbers(matcher.group(2));
            double a = args.isEmpty() ? 0 : args.get(0);
            double[] t = IDENTITY.clone();
            switch (type) {
                case "matrix" -> {
                    if (args.size() == 6) {
                        t = new double[]{args.get(0), args.get(1), args.get(2),
                                args.get(3), args.get(4), args.get(5)};
                    }
                }
                case "translate" -> t = new double[]{1, 0, 0, 1, a, args.size() > 1 ? args.get(1) : 0};
                case "scale" -> {
                    double sx = args.isEmpty() ? 1 : a;
                    double sy = args.size() > 1 ? args.get(1) : sx;
                    t = new double[]{sx, 0, 0, sy, 0, 0};
                }
                case "rotate" -> {
                    double rad = Math.toRadians(a);
                    double cos = Math.cos(rad);
                    double sin = Math.sin(rad);
                    t = new double[]{cos, sin, -sin, cos, 0, 0};
                    if (args.size() == 3) {
                        double cx = args.get(1);
                        double cy = args.get(2);
                        t = multiplyMatrix(new double[]{1, 0, 0, 1, cx, cy},
                                multiplyMatrix(t, new double[]{1, 0, 0, 1, -cx, -cy}));
                    }
                }
                case "skewx" -> t = new double[]{1, 0, Math.tan(Math.toRadians(a)), 1, 0, 0};
                case "skewy" -> t = new double[]{1, Math.tan(Math.toRadians(a)), 0, 1, 0, 0};
                default -> {
                    // неизвестная функция — единичная матрица, как в прототипе
                }
            }
            m = multiplyMatrix(m, t);
        }
        return m;
    }

    /** Произведение матриц {@code m1 * m2} (порт {@code multiplyMatrix}). */
    public double[] multiplyMatrix(double[] m1, double[] m2) {
        return new double[]{
                m1[0] * m2[0] + m1[2] * m2[1],
                m1[1] * m2[0] + m1[3] * m2[1],
                m1[0] * m2[2] + m1[2] * m2[3],
                m1[1] * m2[2] + m1[3] * m2[3],
                m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
                m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
        };
    }

    /** Применение матрицы к точке (порт {@code applyMatrix}). */
    public double[] applyMatrix(double[] m, double x, double y) {
        return new double[]{m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]};
    }

    private List<Double> numbers(String raw) {
        List<Double> out = new ArrayList<>();
        if (raw == null) {
            return out;
        }
        Matcher m = NUMBER_PATTERN.matcher(raw);
        while (m.find()) {
            out.add(Double.parseDouble(m.group()));
        }
        return out;
    }

    // ============================================================
    // Обход дерева (порт collectElements)
    // ============================================================

    /**
     * Обход SVG и сбор длин элементов контура.
     *
     * <p>{@code useTransform = false} — трансформации игнорируются полностью;
     * {@code useTransform = true} — матрицы накапливаются по вложенным {@code <g>}
     * (включая transform самого элемента). Геометрия внутри
     * {@code defs/clipPath/mask/symbol/marker/pattern} не учитывается.
     * {@code <use>} не поддерживается (как и в прототипе): такой элемент не даёт длины.
     *
     * @param svgRoot      корневой {@code <svg>}
     * @param useTransform учитывать ли transform
     * @param useUnits     учитывать ли единицы в атрибутах элементов
     * @param scale        масштаб мм на единицу (нужен для перевода единиц атрибутов)
     */
    public List<ElementInfo> collectElements(Element svgRoot, boolean useTransform,
                                             boolean useUnits, double scale) {
        List<ElementInfo> results = new ArrayList<>();
        if (svgRoot == null) {
            return results;
        }
        walk(svgRoot, IDENTITY.clone(), results, useTransform, useUnits, scale);
        return results;
    }

    private void walk(Node node, double[] parentMatrix, List<ElementInfo> results,
                      boolean useTransform, boolean useUnits, double scale) {
        if (node.getNodeType() != Node.ELEMENT_NODE) {
            return;
        }
        Element el = (Element) node;
        String tag = localTag(el);
        if (IGNORED_TAGS.contains(tag)) {
            return;
        }

        double[] currentMatrix = parentMatrix;
        if (useTransform) {
            String tr = attr(el, "transform");
            if (tr != null && !tr.isBlank()) {
                currentMatrix = multiplyMatrix(parentMatrix, parseTransform(tr));
            }
        }

        if (RELEVANT_TAGS.contains(tag)) {
            double len = useTransform
                    ? getElementLengthWithTransform(el, parentMatrix, useUnits, scale)
                    : getElementLength(el, useUnits, scale);
            if (len > 0) {
                String ownTransform = attr(el, "transform");
                results.add(new ElementInfo(tag, len, ownTransform != null && !ownTransform.isBlank()));
            }
            return;
        }

        NodeList children = el.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            walk(children.item(i), currentMatrix, results, useTransform, useUnits, scale);
        }
    }

    // ============================================================
    // Длина элемента
    // ============================================================

    /** Длина элемента без учёта transform (порт {@code getElementLength}). */
    public double getElementLength(Element el, boolean useUnits, double scale) {
        String tag = localTag(el);
        return switch (tag) {
            case "line" -> lineLength(num(el, "x1", useUnits, scale), num(el, "y1", useUnits, scale),
                    num(el, "x2", useUnits, scale), num(el, "y2", useUnits, scale));
            case "rect" -> 2 * (num(el, "width", useUnits, scale) + num(el, "height", useUnits, scale));
            case "circle" -> 2 * Math.PI * num(el, "r", useUnits, scale);
            case "ellipse" -> ellipsePerimeter(num(el, "rx", useUnits, scale),
                    num(el, "ry", useUnits, scale));
            case "polyline" -> polylineLength(parsePoints(attr(el, "points"), useUnits, scale));
            case "polygon" -> {
                List<double[]> pts = parsePoints(attr(el, "points"), useUnits, scale);
                if (pts.size() < 2) {
                    yield 0;
                }
                List<double[]> closed = new ArrayList<>(pts);
                closed.add(pts.get(0));
                yield polylineLength(closed);
            }
            case "path" -> pathLength(attr(el, "d"), IDENTITY);
            default -> 0;
        };
    }

    /** Длина элемента с учётом матрицы (порт {@code getElementLengthWithTransform}). */
    public double getElementLengthWithTransform(Element el, double[] parentMatrix,
                                                boolean useUnits, double scale) {
        String tag = localTag(el);
        double[] matrix = multiplyMatrix(parentMatrix, parseTransform(attr(el, "transform")));

        return switch (tag) {
            case "line" -> {
                double[] p1 = applyMatrix(matrix,
                        num(el, "x1", useUnits, scale), num(el, "y1", useUnits, scale));
                double[] p2 = applyMatrix(matrix,
                        num(el, "x2", useUnits, scale), num(el, "y2", useUnits, scale));
                yield lineLength(p1[0], p1[1], p2[0], p2[1]);
            }
            case "rect" -> {
                double x = num(el, "x", useUnits, scale);
                double y = num(el, "y", useUnits, scale);
                double w = num(el, "width", useUnits, scale);
                double h = num(el, "height", useUnits, scale);
                if (w <= 0 || h <= 0) {
                    yield 0;
                }
                yield polylineLength(List.of(
                        applyMatrix(matrix, x, y),
                        applyMatrix(matrix, x + w, y),
                        applyMatrix(matrix, x + w, y + h),
                        applyMatrix(matrix, x, y + h),
                        applyMatrix(matrix, x, y)));
            }
            case "circle" -> {
                double cx = num(el, "cx", useUnits, scale);
                double cy = num(el, "cy", useUnits, scale);
                double r = num(el, "r", useUnits, scale);
                if (r <= 0) {
                    yield 0;
                }
                double[] center = applyMatrix(matrix, cx, cy);
                double[] p1 = applyMatrix(matrix, cx + r, cy);
                double[] p2 = applyMatrix(matrix, cx, cy + r);
                yield ellipsePerimeter(Math.abs(p1[0] - center[0]), Math.abs(p2[1] - center[1]));
            }
            case "ellipse" -> {
                double cx = num(el, "cx", useUnits, scale);
                double cy = num(el, "cy", useUnits, scale);
                double rx = num(el, "rx", useUnits, scale);
                double ry = num(el, "ry", useUnits, scale);
                if (rx <= 0 || ry <= 0) {
                    yield 0;
                }
                double[] center = applyMatrix(matrix, cx, cy);
                double[] p1 = applyMatrix(matrix, cx + rx, cy);
                double[] p2 = applyMatrix(matrix, cx, cy + ry);
                yield ellipsePerimeter(Math.abs(p1[0] - center[0]), Math.abs(p2[1] - center[1]));
            }
            case "polyline" -> polylineLength(
                    transformPoints(parsePoints(attr(el, "points"), useUnits, scale), matrix));
            case "polygon" -> {
                List<double[]> pts = parsePoints(attr(el, "points"), useUnits, scale);
                if (pts.size() < 2) {
                    yield 0;
                }
                List<double[]> tPts = transformPoints(pts, matrix);
                List<double[]> closed = new ArrayList<>(tPts);
                closed.add(tPts.get(0));
                yield polylineLength(closed);
            }
            case "path" -> pathLength(attr(el, "d"), matrix);
            default -> 0;
        };
    }

    // ============================================================
    // Вспомогательная геометрия
    // ============================================================

    /** Числовое значение атрибута с учётом единиц (аналог {@code num()} в прототипе). */
    private double num(Element el, String name, boolean useUnits, double scale) {
        String raw = attr(el, name);
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        if (useUnits && hasExplicitUnit(raw)) {
            Double mm = parseLengthToMm(raw);
            if (mm != null) {
                return scale > 0 ? mm / scale : mm;
            }
        }
        Double plain = parseFloatLike(raw);
        return plain == null ? 0 : plain;
    }

    /** Точки из атрибута {@code points} (порт {@code parsePoints}). */
    public List<double[]> parsePoints(String points, boolean useUnits, double scale) {
        List<double[]> out = new ArrayList<>();
        if (points == null || points.isBlank()) {
            return out;
        }
        String[] raw = points.trim().split("[\\s,]+");
        for (int i = 0; i + 1 < raw.length; i += 2) {
            Double x = coordinate(raw[i], useUnits, scale);
            Double y = coordinate(raw[i + 1], useUnits, scale);
            if (x != null && y != null) {
                out.add(new double[]{x, y});
            }
        }
        return out;
    }

    private Double coordinate(String raw, boolean useUnits, double scale) {
        if (useUnits && hasExplicitUnit(raw)) {
            Double mm = parseLengthToMm(raw);
            if (mm != null) {
                return scale > 0 ? mm / scale : mm;
            }
        }
        return parseFloatLike(raw);
    }

    /** Прогон точек через матрицу. */
    private List<double[]> transformPoints(List<double[]> pts, double[] matrix) {
        List<double[]> out = new ArrayList<>(pts.size());
        for (double[] p : pts) {
            out.add(applyMatrix(matrix, p[0], p[1]));
        }
        return out;
    }

    /** Длина ломаной по точкам (порт {@code polylineLength}). */
    public double polylineLength(List<double[]> points) {
        double len = 0;
        for (int i = 0; i + 1 < points.size(); i++) {
            double[] a = points.get(i);
            double[] b = points.get(i + 1);
            len += lineLength(a[0], a[1], b[0], b[1]);
        }
        return len;
    }

    private static double lineLength(double x1, double y1, double x2, double y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    /**
     * Периметр эллипса — приближение Рамануджана
     * {@code π(3(a+b) − √((3a+b)(a+3b)))}.
     *
     * <p>Так было в бэкенде до переноса, и это НЕ меняем (условие задачи).
     * В прототипе используется второе приближение Рамануджана
     * {@code π(a+b)(1 + 3h/(10+√(4−3h)))}: расхождение ≤ 0.001 % (для rx=10, ry=5
     * это 4e-4 ед.), для окружности обе формулы дают ровно {@code 2πr}.
     */
    public double ellipsePerimeter(double rx, double ry) {
        if (rx <= 0 || ry <= 0) {
            return 0;
        }
        return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    }

    private static String attr(Element el, String name) {
        if (el == null || !el.hasAttribute(name)) {
            return null;
        }
        return el.getAttribute(name);
    }

    private static String localTag(Element el) {
        String name = el.getLocalName() != null ? el.getLocalName() : el.getTagName();
        int colon = name.indexOf(':');
        if (colon >= 0) {
            name = name.substring(colon + 1);
        }
        return name.toLowerCase();
    }

    // ============================================================
    // Разбор path (замена браузерного getTotalLength)
    // ============================================================

    /**
     * Длина {@code path} в пользовательских единицах с учётом матрицы.
     *
     * <p>Поддержаны все команды SVG: {@code M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z},
     * абсолютные и относительные, несколько подпутей, неявные повторы ({@code M 0 0 10 10}),
     * отражение контрольных точек для {@code S/T}, замыкание {@code Z}.
     * Кривые разворачиваются в отрезки с допуском {@link #FLAT_TOLERANCE}
     * (прототип вызывал {@code getTotalLength()} браузера — расхождение ≤ 0.01 ед.).
     */
    public double pathLength(String d, double[] matrix) {
        if (d == null || d.isBlank()) {
            return 0;
        }
        double[] m = matrix == null ? IDENTITY : matrix;
        List<Object> tokens = tokenizePath(d);

        double total = 0;
        double cx = 0;
        double cy = 0;
        double sx = 0;
        double sy = 0;
        double lastCubicX = Double.NaN;
        double lastCubicY = Double.NaN;
        double lastQuadX = Double.NaN;
        double lastQuadY = Double.NaN;
        boolean lastWasCubic = false;
        boolean lastWasQuad = false;

        int i = 0;
        while (i < tokens.size()) {
            Object token = tokens.get(i);
            if (!(token instanceof Character)) {
                i++; // «висячее» число вне команды — пропускаем
                continue;
            }
            char command = (Character) token;
            i++;
            boolean rel = Character.isLowerCase(command);
            char upper = Character.toUpperCase(command);

            if (upper == 'Z') {
                total += distance(m, cx, cy, sx, sy);
                cx = sx;
                cy = sy;
                lastWasCubic = false;
                lastWasQuad = false;
                continue;
            }

            int arity = switch (upper) {
                case 'H', 'V' -> 1;
                case 'M', 'L', 'T' -> 2;
                case 'S', 'Q' -> 4;
                case 'C' -> 6;
                case 'A' -> 7;
                default -> 0;
            };
            if (arity == 0) {
                lastWasCubic = false;
                lastWasQuad = false;
                continue; // неизвестная команда — как в прототипе, пропускаем
            }

            boolean firstPair = true;
            paramLoop:
            while (true) {
                double[] p = readNumbers(tokens, i, arity);
                if (p == null) {
                    break;
                }
                i += arity;
                switch (upper) {
                    case 'M' -> {
                        double nx = rel ? cx + p[0] : p[0];
                        double ny = rel ? cy + p[1] : p[1];
                        if (firstPair) {
                            sx = nx;
                            sy = ny;
                        } else {
                            total += distance(m, cx, cy, nx, ny);
                        }
                        cx = nx;
                        cy = ny;
                        lastWasCubic = false;
                        lastWasQuad = false;
                    }
                    case 'L' -> {
                        double nx = rel ? cx + p[0] : p[0];
                        double ny = rel ? cy + p[1] : p[1];
                        total += distance(m, cx, cy, nx, ny);
                        cx = nx;
                        cy = ny;
                        lastWasCubic = false;
                        lastWasQuad = false;
                    }
                    case 'H' -> {
                        double nx = rel ? cx + p[0] : p[0];
                        total += distance(m, cx, cy, nx, cy);
                        cx = nx;
                        lastWasCubic = false;
                        lastWasQuad = false;
                    }
                    case 'V' -> {
                        double ny = rel ? cy + p[0] : p[0];
                        total += distance(m, cx, cy, cx, ny);
                        cy = ny;
                        lastWasCubic = false;
                        lastWasQuad = false;
                    }
                    case 'C' -> {
                        double x1 = rel ? cx + p[0] : p[0];
                        double y1 = rel ? cy + p[1] : p[1];
                        double x2 = rel ? cx + p[2] : p[2];
                        double y2 = rel ? cy + p[3] : p[3];
                        double x = rel ? cx + p[4] : p[4];
                        double y = rel ? cy + p[5] : p[5];
                        total += cubicLength(m, cx, cy, x1, y1, x2, y2, x, y);
                        lastCubicX = x2;
                        lastCubicY = y2;
                        lastWasCubic = true;
                        lastWasQuad = false;
                        cx = x;
                        cy = y;
                    }
                    case 'S' -> {
                        double x2 = rel ? cx + p[0] : p[0];
                        double y2 = rel ? cy + p[1] : p[1];
                        double x = rel ? cx + p[2] : p[2];
                        double y = rel ? cy + p[3] : p[3];
                        double x1 = lastWasCubic ? 2 * cx - lastCubicX : cx;
                        double y1 = lastWasCubic ? 2 * cy - lastCubicY : cy;
                        total += cubicLength(m, cx, cy, x1, y1, x2, y2, x, y);
                        lastCubicX = x2;
                        lastCubicY = y2;
                        lastWasCubic = true;
                        lastWasQuad = false;
                        cx = x;
                        cy = y;
                    }
                    case 'Q' -> {
                        double qx = rel ? cx + p[0] : p[0];
                        double qy = rel ? cy + p[1] : p[1];
                        double x = rel ? cx + p[2] : p[2];
                        double y = rel ? cy + p[3] : p[3];
                        total += quadLength(m, cx, cy, qx, qy, x, y);
                        lastQuadX = qx;
                        lastQuadY = qy;
                        lastWasCubic = false;
                        lastWasQuad = true;
                        cx = x;
                        cy = y;
                    }
                    case 'T' -> {
                        double x = rel ? cx + p[0] : p[0];
                        double y = rel ? cy + p[1] : p[1];
                        double qx = lastWasQuad ? 2 * cx - lastQuadX : cx;
                        double qy = lastWasQuad ? 2 * cy - lastQuadY : cy;
                        total += quadLength(m, cx, cy, qx, qy, x, y);
                        lastQuadX = qx;
                        lastQuadY = qy;
                        lastWasCubic = false;
                        lastWasQuad = true;
                        cx = x;
                        cy = y;
                    }
                    case 'A' -> {
                        boolean largeArc = p[3] != 0;
                        boolean sweep = p[4] != 0;
                        double x = rel ? cx + p[5] : p[5];
                        double y = rel ? cy + p[6] : p[6];
                        total += arcLength(m, cx, cy, Math.abs(p[0]), Math.abs(p[1]),
                                p[2], largeArc, sweep, x, y);
                        cx = x;
                        cy = y;
                        lastWasCubic = false;
                        lastWasQuad = false;
                    }
                    default -> {
                        break paramLoop;
                    }
                }
                firstPair = false;
            }
        }
        return total;
    }

    private List<Object> tokenizePath(String d) {
        List<Object> tokens = new ArrayList<>();
        Matcher m = PATH_TOKEN_PATTERN.matcher(d);
        while (m.find()) {
            if (m.group(1) != null) {
                tokens.add(m.group(1).charAt(0));
            } else {
                tokens.add(Double.parseDouble(m.group(2)));
            }
        }
        return tokens;
    }

    private double[] readNumbers(List<Object> tokens, int from, int count) {
        if (from + count > tokens.size()) {
            return null;
        }
        double[] out = new double[count];
        for (int k = 0; k < count; k++) {
            Object token = tokens.get(from + k);
            if (!(token instanceof Double)) {
                return null;
            }
            out[k] = (Double) token;
        }
        return out;
    }

    /** Расстояние между точками после применения матрицы. */
    private double distance(double[] m, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        return Math.hypot(m[0] * dx + m[2] * dy, m[1] * dx + m[3] * dy);
    }

    /** Длина кривой, заданной точками, с применением матрицы к каждой точке. */
    private double transformedLength(double[] m, double startX, double startY, List<double[]> points) {
        double[] prev = applyMatrix(m, startX, startY);
        double len = 0;
        for (double[] p : points) {
            double[] cur = applyMatrix(m, p[0], p[1]);
            len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
            prev = cur;
        }
        return len;
    }

    /** Длина кубической Безье (C/S) в пользовательских единицах с матрицей. */
    private double cubicLength(double[] m, double x0, double y0, double x1, double y1,
                               double x2, double y2, double x3, double y3) {
        List<double[]> points = new ArrayList<>();
        flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, 0, points);
        return transformedLength(m, x0, y0, points);
    }

    /** Длина квадратичной Безье (Q/T): приводится к кубической и разворачивается. */
    private double quadLength(double[] m, double x0, double y0, double qx, double qy,
                              double x1, double y1) {
        double c1x = x0 + 2.0 / 3.0 * (qx - x0);
        double c1y = y0 + 2.0 / 3.0 * (qy - y0);
        double c2x = x1 + 2.0 / 3.0 * (qx - x1);
        double c2y = y1 + 2.0 / 3.0 * (qy - y1);
        return cubicLength(m, x0, y0, c1x, c1y, c2x, c2y, x1, y1);
    }

    /** Адаптивное разворачивание кубической Безье в точки (де Кастельжо). */
    private void flattenCubic(double x0, double y0, double x1, double y1,
                              double x2, double y2, double x3, double y3,
                              int depth, List<double[]> out) {
        if (depth >= MAX_SUBDIVISION_DEPTH || isFlat(x0, y0, x1, y1, x2, y2, x3, y3)) {
            out.add(new double[]{x3, y3});
            return;
        }
        double x01 = (x0 + x1) / 2;
        double y01 = (y0 + y1) / 2;
        double x12 = (x1 + x2) / 2;
        double y12 = (y1 + y2) / 2;
        double x23 = (x2 + x3) / 2;
        double y23 = (y2 + y3) / 2;
        double x012 = (x01 + x12) / 2;
        double y012 = (y01 + y12) / 2;
        double x123 = (x12 + x23) / 2;
        double y123 = (y12 + y23) / 2;
        double x0123 = (x012 + x123) / 2;
        double y0123 = (y012 + y123) / 2;
        flattenCubic(x0, y0, x01, y01, x012, y012, x0123, y0123, depth + 1, out);
        flattenCubic(x0123, y0123, x123, y123, x23, y23, x3, y3, depth + 1, out);
    }

    /** Отклонение контрольных точек от хорды меньше допуска — кривая считается прямой. */
    private boolean isFlat(double x0, double y0, double x1, double y1,
                           double x2, double y2, double x3, double y3) {
        double dx = x3 - x0;
        double dy = y3 - y0;
        double len = Math.hypot(dx, dy);
        if (len < 1e-9) {
            return Math.hypot(x1 - x0, y1 - y0) <= FLAT_TOLERANCE
                    && Math.hypot(x2 - x0, y2 - y0) <= FLAT_TOLERANCE;
        }
        double d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx);
        double d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx);
        return (d1 + d2) / len <= FLAT_TOLERANCE;
    }

    /**
     * Длина дуги эллипса {@code A/a}: перевод в центровые параметры по SVG 1.1 (F.6.5)
     * и выборка точками с шагом, при котором стрелка прогиба хорды ≤ {@link #FLAT_TOLERANCE}.
     */
    private double arcLength(double[] m, double x1, double y1, double rx, double ry,
                             double xAxisRotationDeg, boolean largeArc, boolean sweep,
                             double x2, double y2) {
        if (rx == 0 || ry == 0 || (x1 == x2 && y1 == y2)) {
            return distance(m, x1, y1, x2, y2);
        }
        double phi = Math.toRadians(xAxisRotationDeg % 360);
        double cosPhi = Math.cos(phi);
        double sinPhi = Math.sin(phi);
        double dx2 = (x1 - x2) / 2;
        double dy2 = (y1 - y2) / 2;
        double x1p = cosPhi * dx2 + sinPhi * dy2;
        double y1p = -sinPhi * dx2 + cosPhi * dy2;

        double lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lambda > 1) {
            double s = Math.sqrt(lambda);
            rx *= s;
            ry *= s;
        }

        double num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
        double den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
        double coef = den == 0 ? 0 : Math.sqrt(Math.max(0, num / den));
        if (largeArc == sweep) {
            coef = -coef;
        }
        double cxp = coef * (rx * y1p / ry);
        double cyp = coef * (-ry * x1p / rx);
        double cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
        double cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

        double ux = (x1p - cxp) / rx;
        double uy = (y1p - cyp) / ry;
        double vx = (-x1p - cxp) / rx;
        double vy = (-y1p - cyp) / ry;
        double theta1 = Math.atan2(uy, ux);
        double dTheta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        if (!sweep && dTheta > 0) {
            dTheta -= 2 * Math.PI;
        }
        if (sweep && dTheta < 0) {
            dTheta += 2 * Math.PI;
        }

        int segments = segmentsForArc(Math.max(rx, ry), Math.abs(dTheta));
        List<double[]> points = new ArrayList<>(segments);
        for (int i = 1; i <= segments; i++) {
            double t = theta1 + dTheta * i / segments;
            double px = cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi;
            double py = cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi;
            points.add(new double[]{px, py});
        }
        return transformedLength(m, x1, y1, points);
    }

    /** Число отрезков для дуги: по стрелке прогиба, 8…256 (точность 0.001 ед.). */
    private int segmentsForArc(double radius, double sweepAngle) {
        if (sweepAngle <= 0 || radius <= 0) {
            return 1;
        }
        double ratio = Math.min(1, Math.max(-1, 1 - FLAT_TOLERANCE / radius));
        double maxStep = 2 * Math.acos(ratio);
        if (maxStep <= 0) {
            return 256;
        }
        int n = (int) Math.ceil(sweepAngle / maxStep);
        return Math.min(256, Math.max(8, n));
    }
}
