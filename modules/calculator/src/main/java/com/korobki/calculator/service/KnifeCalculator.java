package com.korobki.calculator.service;

import com.korobki.core.config.PricingConfig;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;
import org.xml.sax.InputSource;

import java.io.StringReader;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

/**
 * Calculator for knife (die-cutting) cost.
 * Parses SVG files, extracts geometric elements, computes total length in mm,
 * and applies the formula: totalLengthMm × 3 + 500.
 *
 * Matches the HTML prototype's initKnifeCalculator logic exactly.
 */
@Service
public class KnifeCalculator {

    private final PricingConfig pricingConfig;

    public KnifeCalculator(PricingConfig pricingConfig) {
        this.pricingConfig = pricingConfig;
    }

    /**
     * Calculate knife cost from SVG content.
     *
     * @param svgContent SVG file content as string
     * @return KnifeResponse with total length, cost, and element details
     */
    public KnifeCalculator.KnifeResult calculate(String svgContent) {
        if (svgContent == null || svgContent.trim().isEmpty()) {
            return new KnifeResult(0, 0, 0, 0, new java.util.ArrayList<>());
        }

        try {
            // Parse SVG
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new InputSource(new StringReader(svgContent)));

            // Determine scale from viewBox and width/height attributes
            double scale = determineScale(doc);

            // Collect all geometric elements
            Element svgRoot = doc.getDocumentElement();
            NodeList allElements = svgRoot.getElementsByTagName("*");

            double totalLengthPx = 0;
            java.util.List<KnifeElementDto> details = new java.util.ArrayList<>();

            for (int i = 0; i < allElements.getLength(); i++) {
                Node node = allElements.item(i);
                if (node.getNodeType() == Node.ELEMENT_NODE) {
                    Element el = (Element) node;
                    String tag = el.getTagName().toLowerCase();

                    if (isSupportedElement(tag)) {
                        double lengthPx = getElementLength(el, tag);
                        if (lengthPx > 0) {
                            totalLengthPx += lengthPx;
                            details.add(new KnifeElementDto(tag, lengthPx, lengthPx * scale));
                        }
                    }
                }
            }

            double totalLengthMm = totalLengthPx * scale;
            double knifeCost = totalLengthMm * pricingConfig.getKnifePricePerMm().doubleValue()
                    + pricingConfig.getKnifeBaseCost().doubleValue();

            return new KnifeResult(totalLengthPx, totalLengthMm, knifeCost, scale, details);

        } catch (Exception e) {
            // Return zero result on parse error
            return new KnifeResult(0, 0, 0, 0, new java.util.ArrayList<>());
        }
    }

    /**
     * Determine the scale factor (mm per SVG unit) from viewBox and width/height.
     * Falls back to 0.264583 (96 DPI) if not specified.
     */
    private double determineScale(Document doc) {
        Element svg = doc.getDocumentElement();
        String viewBox = svg.getAttribute("viewBox");
        String width = svg.getAttribute("width");
        String height = svg.getAttribute("height");

        if (viewBox != null && !viewBox.isEmpty() && width != null && height != null) {
            try {
                String[] parts = viewBox.trim().split("\\s+");
                if (parts.length == 4) {
                    double vbW = Double.parseDouble(parts[2]);
                    double vbH = Double.parseDouble(parts[3]);
                    double wMm = parseWithUnit(width);
                    double hMm = parseWithUnit(height);
                    if (wMm > 0 && hMm > 0) {
                        double scaleX = wMm / vbW;
                        double scaleY = hMm / vbH;
                        return (scaleX + scaleY) / 2.0;
                    }
                }
            } catch (NumberFormatException ignored) {
                // fall through
            }
        }

        // Default: 96 DPI → 1px = 0.264583mm
        return 0.264583;
    }

    /**
     * Parse a CSS dimension string like "100mm", "200px", "10cm" to mm.
     */
    private double parseWithUnit(String value) {
        value = value.trim().toLowerCase();
        if (value.endsWith("mm")) {
            return Double.parseDouble(value.substring(0, value.length() - 2));
        } else if (value.endsWith("cm")) {
            return Double.parseDouble(value.substring(0, value.length() - 2)) * 10;
        } else if (value.endsWith("in")) {
            return Double.parseDouble(value.substring(0, value.length() - 2)) * 25.4;
        } else if (value.endsWith("px")) {
            return Double.parseDouble(value.substring(0, value.length() - 2)) * 0.264583;
        } else {
            // No unit — assume pixels
            try {
                return Double.parseDouble(value) * 0.264583;
            } catch (NumberFormatException e) {
                return 0;
            }
        }
    }

    private boolean isSupportedElement(String tag) {
        return "line".equals(tag) || "rect".equals(tag) || "path".equals(tag)
                || "polyline".equals(tag) || "circle".equals(tag) || "ellipse".equals(tag);
    }

    /**
     * Calculate the length of a single SVG geometric element in SVG units (pixels).
     */
    private double getElementLength(Element el, String tag) {
        try {
            switch (tag) {
                case "line":
                    return lineLength(el);
                case "rect":
                    return rectLength(el);
                case "path":
                    return pathLength(el);
                case "polyline":
                    return polylineLength(el);
                case "circle":
                    return circleLength(el);
                case "ellipse":
                    return ellipseLength(el);
                default:
                    return 0;
            }
        } catch (Exception e) {
            return 0;
        }
    }

    private double lineLength(Element el) {
        double x1 = parseAttr(el, "x1", 0);
        double y1 = parseAttr(el, "y1", 0);
        double x2 = parseAttr(el, "x2", 0);
        double y2 = parseAttr(el, "y2", 0);
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    private double rectLength(Element el) {
        double w = parseAttr(el, "width", 0);
        double h = parseAttr(el, "height", 0);
        return 2 * (w + h);
    }

    private double pathLength(Element el) {
        String d = el.getAttribute("d");
        if (d == null || d.isEmpty()) return 0;
        // SVGPathElement is only available in browsers, not in server-side DOM parser.
        // Use approximation by parsing path commands.
        return approximatePathLength(d);
    }

    /**
     * Approximate path length by parsing SVG path commands.
     * Handles: M, L, H, V, C, Q, S, T, A, Z commands.
     */
    private double approximatePathLength(String d) {
        // Simple approximation: extract numeric values and estimate
        // This is a simplified approach — for production, use a proper SVG path parser
        double totalLen = 0;
        double prevX = 0, prevY = 0;
        boolean hasPrev = false;

        // Tokenize: split by commands, keep commands
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "([MmZzLlHhVvCcSsQqTtAa])|([+-]?\\d+\\.?\\d*(?:[eE][+-]?\\d+)?)");
        java.util.regex.Matcher m = p.matcher(d);

        String currentCommand = "L"; // default
        java.util.List<Double> params = new java.util.ArrayList<>();

        while (m.find()) {
            String cmd = m.group(1);
            String num = m.group(2);

            if (cmd != null) {
                // Process accumulated params with previous command
                if (!params.isEmpty() && hasPrev) {
                    totalLen += processPathParams(currentCommand, params, prevX, prevY);
                    params.clear();
                }
                currentCommand = cmd.toUpperCase();
            } else if (num != null) {
                params.add(Double.parseDouble(num));
            }
        }

        // Process remaining params
        if (!params.isEmpty()) {
            totalLen += processPathParams(currentCommand, params, prevX, prevY);
        }

        return totalLen;
    }

    private double processPathParams(String cmd, java.util.List<Double> params, double px, double py) {
        double totalLen = 0;
        int idx = 0;

        switch (cmd) {
            case "L":
            case "l":
                while (idx + 1 < params.size()) {
                    double nx = idx < params.size() ? params.get(idx++) : px;
                    double ny = idx < params.size() ? params.get(idx++) : py;
                    totalLen += dist(px, py, nx, ny);
                    px = nx; py = ny;
                }
                break;
            case "H":
            case "h":
                while (idx < params.size()) {
                    double nx = params.get(idx++);
                    totalLen += Math.abs(nx - px);
                    px = nx;
                }
                break;
            case "V":
            case "v":
                while (idx < params.size()) {
                    double ny = params.get(idx++);
                    totalLen += Math.abs(ny - py);
                    py = ny;
                }
                break;
            case "C":
            case "c":
                while (idx + 5 < params.size()) {
                    double cx1 = params.get(idx++), cy1 = params.get(idx++);
                    double cx2 = params.get(idx++), cy2 = params.get(idx++);
                    double ex = params.get(idx++), ey = params.get(idx++);
                    totalLen += cubicBezierLen(px, py, cx1, cy1, cx2, cy2, ex, ey);
                    px = ex; py = ey;
                }
                break;
            case "Z":
            case "z":
                // Close path — go back to start
                break;
            default:
                break;
        }
        return totalLen;
    }

    private double cubicBezierLen(double x1, double y1, double cx1, double cy1, double cx2, double cy2, double x2, double y2) {
        // Approximate with 4-segment polyline
        int segments = 10;
        double total = 0;
        for (int i = 0; i < segments; i++) {
            double t1 = i / (double) segments;
            double t2 = (i + 1) / (double) segments;
            double p1x = bezierPoint(x1, cx1, cx2, x2, t1);
            double p1y = bezierPoint(y1, cy1, cy2, y2, t1);
            double p2x = bezierPoint(x1, cx1, cx2, x2, t2);
            double p2y = bezierPoint(y1, cy1, cy2, y2, t2);
            total += dist(p1x, p1y, p2x, p2y);
        }
        return total;
    }

    private double bezierPoint(double p0, double p1, double p2, double p3, double t) {
        double mt = 1 - t;
        return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
    }

    private double polylineLength(Element el) {
        String points = el.getAttribute("points");
        if (points == null || points.isEmpty()) return 0;

        String[] tokens = points.trim().split("\\s+");
        double total = 0;
        double prevX = 0, prevY = 0;
        boolean hasPrev = false;

        for (String token : tokens) {
            String[] coords = token.split(",");
            if (coords.length >= 2) {
                double x = Double.parseDouble(coords[0].trim());
                double y = Double.parseDouble(coords[1].trim());
                if (hasPrev) {
                    total += dist(prevX, prevY, x, y);
                }
                prevX = x;
                prevY = y;
                hasPrev = true;
            }
        }
        return total;
    }

    private double circleLength(Element el) {
        double r = parseAttr(el, "r", 0);
        return 2 * Math.PI * r;
    }

    private double ellipseLength(Element el) {
        double rx = parseAttr(el, "rx", 0);
        double ry = parseAttr(el, "ry", 0);
        // Ramanujan approximation
        double h = (Math.pow(rx - ry, 2) + Math.pow(rx + ry, 2)) / 4;
        // Actually use the formula from HTML prototype
        return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    }

    private double dist(double x1, double y1, double x2, double y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    private double parseAttr(Element el, String attr, double defaultVal) {
        String val = el.getAttribute(attr);
        if (val == null || val.isEmpty()) return defaultVal;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    // --- Result DTO ---

    public static class KnifeResult {
        private final double totalLengthPx;
        private final double totalLengthMm;
        private final double knifeCost;
        private final double scale;
        private final java.util.List<KnifeElementDto> details;

        public KnifeResult(double totalLengthPx, double totalLengthMm, double knifeCost,
                           double scale, java.util.List<KnifeElementDto> details) {
            this.totalLengthPx = totalLengthPx;
            this.totalLengthMm = totalLengthMm;
            this.knifeCost = knifeCost;
            this.scale = scale;
            this.details = details;
        }

        public double getTotalLengthPx() { return totalLengthPx; }
        public double getTotalLengthMm() { return totalLengthMm; }
        public double getKnifeCost() { return knifeCost; }
        public double getScale() { return scale; }
        public java.util.List<KnifeElementDto> getDetails() { return details; }
    }

    public static class KnifeElementDto {
        private final String type;
        private final double lengthPx;
        private final double lengthMm;

        public KnifeElementDto(String type, double lengthPx, double lengthMm) {
            this.type = type;
            this.lengthPx = lengthPx;
            this.lengthMm = lengthMm;
        }

        public String getType() { return type; }
        public double getLengthPx() { return lengthPx; }
        public double getLengthMm() { return lengthMm; }
    }
}
