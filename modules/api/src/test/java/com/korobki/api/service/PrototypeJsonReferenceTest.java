package com.korobki.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.DetailDto;
import com.korobki.api.dto.ExtraDto;
import com.korobki.api.dto.PriceRowDto;
import com.korobki.api.dto.PrintSettingsDto;
import com.korobki.calculator.service.CostCalculator;
import com.korobki.calculator.service.PrintCostCalculator;
import com.korobki.core.config.PricingConfig;
import com.korobki.persistence.entity.PrintTable;
import com.korobki.persistence.repository.PrintTableRepository;
import com.korobki.pricing.PriceCalculator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Reference regression test for the HTML prototype port.
 *
 * Reads the prototype snapshot "Паллена 9 Тест.json", maps it to the current
 * CalculationRequest, runs the real calculation pipeline and compares every
 * value with the HTML prototype formulas (calcCostPriceDet /
 * calcPrintPerUnitNoVat / generatePrices).
 *
 * The report is printed to stdout and written to
 * prototype-comparison-report.md in the project root.
 *
 * Any mismatch in print cost, total cost, base price or tier prices fails the
 * build, so the prototype math cannot silently regress.
 */
class PrototypeJsonReferenceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final BigDecimal VAT_RATE = new BigDecimal("0.11");
    private static final String[] TIER_LABELS = {
            "до 9", "10–49", "50–199", "200–499", "500–699", "700–1499", "от 1500"
    };
    private static final double[] X3_COEFFICIENTS = {1.0, 1.0, 0.95, 0.90, 0.85, 0.80, 0.75};
    private static final double[] CORRECTIONS = {7, 0, -2, -4, -6, -8, -10};

    @Test
    void comparePrototypeJsonWithCurrentPipeline() throws Exception {
        Path projectRoot = findProjectRoot();
        JsonNode json = MAPPER.readTree(projectRoot.resolve("Паллена 9 Тест.json").toFile());

        CalculationRequest request = toRequest(json);
        CalculationResponse actual = buildService().calculate(request);
        Expected expected = calculatePrototypeExpected(json);

        String report = buildReport(request, actual, expected);
        Path reportPath = projectRoot.resolve("prototype-comparison-report.md");
        Files.writeString(reportPath, report);

        System.out.println();
        System.out.println(report);

        assertTrue(Files.exists(reportPath), "Comparison report must be written");
        assertEquals(7, actual.getPrices().size(), "All seven price tiers must be calculated");
        assertReferenceMatches(actual, expected);
    }

    /** Strict checks against the values produced by the HTML prototype. */
    private static void assertReferenceMatches(CalculationResponse actual, Expected expected) {
        assertEquals(0, BigDecimal.valueOf(expected.printPerUnit()).compareTo(actual.getPrintCostPerUnit()),
                "Print cost per printed detail");
        assertEquals(expected.branch(), actual.getBranch(), "Pricing branch");

        assertEquals(0, BigDecimal.valueOf(expected.total()).setScale(2, RoundingMode.HALF_UP)
                        .compareTo(actual.getTotalCost().setScale(2, RoundingMode.HALF_UP)),
                "Total cost (rounded to kopecks)");

        assertEquals(0, expected.basePrice().setScale(0, RoundingMode.HALF_UP)
                        .compareTo(actual.getBasePrice().setScale(0, RoundingMode.HALF_UP)),
                "Base price");
        assertEquals(expected.basePriceWithVat(), actual.getBasePriceWithVAT().intValue(),
                "Base price with VAT");

        assertEquals(expected.prices().size(), actual.getPrices().size(), "Price tier count");
        for (int i = 0; i < expected.prices().size(); i++) {
            ExpectedPrice expectedPrice = expected.prices().get(i);
            PriceRowDto actualPrice = actual.getPrices().get(i);
            String tier = expectedPrice.label();

            assertEquals(0, expectedPrice.withoutVat().compareTo(actualPrice.getWithoutVAT()),
                    "Without VAT, tier " + tier);
            assertEquals(expectedPrice.calculatedPrice(), actualPrice.getCalculatedPrice(),
                    "Calculated price, tier " + tier);
            assertEquals(expectedPrice.priceListPrice(), actualPrice.getPriceListPrice(),
                    "Price-list price, tier " + tier);
            assertEquals(expectedPrice.finalPrice(), actualPrice.getFinalPrice(),
                    "Final price, tier " + tier);
        }
    }

    // ------------------------------------------------------------------
    // Prototype snapshot -> current API request
    // ------------------------------------------------------------------

    /**
     * Maps the prototype export to CalculationRequest.
     *
     * Important mapping decisions:
     * - printSettings.boxCount (boxes in the run) -> printSettings.quantity;
     * - has&lt;Operation&gt; booleans -> detail.operations map;
     * - partsPerSheetOnPrint -> detail.partsPerSheetOnPrint.
     */
    private static CalculationRequest toRequest(JsonNode json) {
        CalculationRequest request = new CalculationRequest();
        request.setConstruction(json.path("construction").asText());

        List<DetailDto> details = new ArrayList<>();
        for (JsonNode node : json.withArray("details")) {
            DetailDto detail = new DetailDto();
            detail.setName(node.path("name").asText());
            detail.setCountOnSheet(node.path("countOnSheet").decimalValue());
            detail.setSheetPrice(node.path("sheetPrice").decimalValue());
            detail.setIsPrinted(node.path("isPrinted").asBoolean());
            detail.setPartsPerSheetOnPrint(node.path("partsPerSheetOnPrint").asInt(1));
            detail.setIsCustom(node.path("isCustom").asBoolean());
            detail.setEnabled(node.path("enabled").asBoolean());

            Map<String, Boolean> operations = new LinkedHashMap<>();
            Iterator<String> fields = node.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                if (field.startsWith("has")) {
                    operations.put(field.substring(3), node.path(field).asBoolean());
                }
            }
            detail.setOperations(operations);
            details.add(detail);
        }
        request.setDetails(details);

        List<ExtraDto> extras = new ArrayList<>();
        for (JsonNode node : json.withArray("extras")) {
            ExtraDto extra = new ExtraDto();
            extra.setName(node.path("name").asText());
            extra.setCost(node.path("cost").decimalValue());
            extra.setEnabled(true);
            extras.add(extra);
        }
        request.setExtras(extras);

        JsonNode print = json.path("printSettings");
        PrintSettingsDto printSettings = new PrintSettingsDto();
        printSettings.setEnabled(print.path("enabled").asBoolean());
        printSettings.setFormat(print.path("format").asInt());
        printSettings.setQuantity(print.path("boxCount").asInt());
        request.setPrintSettings(printSettings);

        request.setWorkPrice(json.path("workPrice").decimalValue());
        request.setMarginValue(json.path("marginValue").decimalValue());

        Map<String, BigDecimal> priceList = new LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> priceFields = json.path("priceList").fields();
        while (priceFields.hasNext()) {
            Map.Entry<String, JsonNode> entry = priceFields.next();
            priceList.put(entry.getKey(), entry.getValue().decimalValue());
        }
        request.setPriceList(priceList);

        return request;
    }

    private static CalculatorService buildService() {
        PricingConfig config = new PricingConfig();
        config.setManufacturingCost(new BigDecimal("5.0"));
        config.setMarkupMin(new BigDecimal("30.0"));
        config.setMarkupMultiplier(new BigDecimal("3.0"));
        config.setTaxRate(VAT_RATE);

        PrintTableRepository repository = mock(PrintTableRepository.class);
        PrintTable table = new PrintTable();
        table.setFormatId(1);
        table.setFormatName("Малый формат (до 350×500)");
        table.setSteps(format1Steps());
        table.setStepAfter3000(new BigDecimal("1500"));
        when(repository.findByFormatId(1)).thenReturn(Optional.of(table));

        PrintCostCalculator printCostCalculator = new PrintCostCalculator(repository);
        CostCalculator costCalculator = new CostCalculator(printCostCalculator, config);
        PriceCalculator priceCalculator = new PriceCalculator(config);
        return new CalculatorService(costCalculator, priceCalculator, printCostCalculator);
    }

    private static List<Map<String, Object>> format1Steps() {
        return List.of(
                Map.of("minQty", 100, "price", 5500),
                Map.of("minQty", 300, "price", 7500),
                Map.of("minQty", 500, "price", 9000),
                Map.of("minQty", 1000, "price", 10500),
                Map.of("minQty", 1500, "price", 12000),
                Map.of("minQty", 2000, "price", 13500),
                Map.of("minQty", 3000, "price", 15000)
        );
    }

    // ------------------------------------------------------------------
    // Prototype reference formulas (direct port of the HTML prototype)
    // ------------------------------------------------------------------

    private static Expected calculatePrototypeExpected(JsonNode json) {
        double workPrice = json.path("workPrice").asDouble();
        double margin = json.path("marginValue").asDouble();
        JsonNode printSettings = json.path("printSettings");
        boolean printEnabled = printSettings.path("enabled").asBoolean();
        int boxCount = printSettings.path("boxCount").asInt();

        List<ExpectedDetail> details = new ArrayList<>();
        double total = 0;
        for (JsonNode node : json.withArray("details")) {
            if (!node.path("enabled").asBoolean() || node.path("countOnSheet").asInt() == 0) {
                continue;
            }

            double material = node.path("sheetPrice").asDouble() / node.path("countOnSheet").asDouble();
            double operationCost = 0;
            for (JsonNode extra : json.withArray("extras")) {
                String flag = "has" + extra.path("name").asText();
                if (node.path(flag).asBoolean()) {
                    operationCost += extra.path("cost").asDouble();
                }
            }

            double print = 0;
            if (node.path("isPrinted").asBoolean() && printEnabled) {
                print = calcPrintPerUnitNoVat(
                        printSettings.path("format").asInt(),
                        boxCount,
                        node.path("partsPerSheetOnPrint").asInt(1),
                        printEnabled,
                        node.path("isPrinted").asBoolean()
                );
            }

            double detailTotal = material + workPrice + operationCost + print;
            details.add(new ExpectedDetail(
                    node.path("name").asText(), material, workPrice, operationCost, print, detailTotal));
            total += detailTotal;
        }

        int roundedCost = (int) Math.round(total);
        double basePrice = Math.min(roundedCost * 3.0, roundedCost + margin);
        String branch = roundedCost * 3.0 < roundedCost + margin ? "×3" : "+" + (int) margin;

        List<ExpectedPrice> prices = new ArrayList<>();
        for (int i = 0; i < TIER_LABELS.length; i++) {
            double priceWithoutVat = "×3".equals(branch)
                    ? basePrice * X3_COEFFICIENTS[i]
                    : basePrice + CORRECTIONS[i];
            int calculatedPrice = (int) Math.round(priceWithoutVat * (1 + VAT_RATE.doubleValue()));
            int priceListPrice = json.path("priceList").path(TIER_LABELS[i]).asInt(0);
            int finalPrice = priceListPrice > 0 && calculatedPrice < priceListPrice
                    ? priceListPrice
                    : calculatedPrice;
            prices.add(new ExpectedPrice(
                    TIER_LABELS[i],
                    BigDecimal.valueOf(priceWithoutVat).setScale(2, RoundingMode.HALF_UP),
                    calculatedPrice,
                    priceListPrice,
                    finalPrice
            ));
        }

        double lidPrint = 0;
        for (ExpectedDetail detail : details) {
            if ("Крышка".equals(detail.name())) {
                lidPrint = detail.print();
            }
        }

        return new Expected(
                lidPrint,
                total,
                BigDecimal.valueOf(basePrice),
                branch,
                (int) Math.round(basePrice * (1 + VAT_RATE.doubleValue())),
                details,
                prices
        );
    }

    /** calcPrintCost(format, quantity) from the prototype. */
    private static double calcPrintCost(int quantity) {
        List<Map<String, Object>> steps = format1Steps();
        if (quantity >= 3000) {
            Map<String, Object> last = steps.get(steps.size() - 1);
            double extra = Math.ceil((quantity - 3000) / 1000.0) * 1500;
            return ((Number) last.get("price")).doubleValue() + extra;
        }
        for (Map<String, Object> step : steps) {
            if (((Number) step.get("minQty")).intValue() >= quantity) {
                return ((Number) step.get("price")).doubleValue();
            }
        }
        return ((Number) steps.get(0).get("price")).doubleValue();
    }

    /** calcPrintPerUnitNoVat(settings, detail) from the prototype. */
    private static double calcPrintPerUnitNoVat(
            int format, int boxCount, int partsPerSheetOnPrint, boolean printEnabled, boolean isPrinted) {
        if (!printEnabled || !isPrinted) {
            return 0;
        }
        int parts = partsPerSheetOnPrint > 0 ? partsPerSheetOnPrint : 1;
        if (boxCount <= 0 || parts > boxCount) {
            return 0;
        }
        int rawSheets = (int) Math.ceil((double) boxCount / parts);
        double printBill = calcPrintCost(rawSheets);
        return (printBill / boxCount) / parts;
    }


    // ------------------------------------------------------------------
    // Report
    // ------------------------------------------------------------------

    private static String buildReport(
            CalculationRequest request,
            CalculationResponse actual,
            Expected expected) {
        StringBuilder report = new StringBuilder();
        report.append("# Сравнение эталона прототипа с текущим расчётом\n\n");
        report.append("Источник: `Паллена 9 Тест.json` (снимок состояния прототипа).\n\n");
        report.append("Маппинг: `printSettings.boxCount` → `printSettings.quantity`; ")
                .append("`has<Операция>` → `detail.operations`; ")
                .append("`partsPerSheetOnPrint` → `detail.partsPerSheetOnPrint`.\n\n");

        report.append("| Параметр | В прототипе | В React/Java (факт) | Совпадает? |\n");
        report.append("|---|---:|---:|:---:|\n");

        report.append(row("Печать на 1 деталь «Крышка», ₽",
                money(expected.printPerUnit()),
                money(actual.getPrintCostPerUnit()),
                same(expected.printPerUnit(), actual.getPrintCostPerUnit().doubleValue())));

        for (ExpectedDetail expectedDetail : expected.details()) {
            DetailDto detail = findDetail(request, expectedDetail.name());
            double actualDetail = actualDetailCost(detail, request, actual);
            report.append(row(
                    "Себестоимость «" + expectedDetail.name() + "», ₽",
                    money(expectedDetail.total()),
                    money(actualDetail),
                    same(expectedDetail.total(), actualDetail)));
        }

        report.append(row("Итоговая себестоимость (до округления), ₽",
                money(expected.total()),
                money(actual.getTotalCost()),
                same(expected.total(), actual.getTotalCost().doubleValue())));

        BigDecimal expectedRounded = BigDecimal.valueOf(Math.round(expected.total()));
        BigDecimal actualRounded = actual.getTotalCost()
                .setScale(2, RoundingMode.HALF_UP)
                .setScale(0, RoundingMode.HALF_UP);
        report.append(row("Округлённая себестоимость, ₽",
                expectedRounded.toPlainString(),
                actualRounded.toPlainString(),
                same(expectedRounded, actualRounded)));

        report.append(row("Базовая цена (без НДС), ₽",
                expected.basePrice().setScale(0, RoundingMode.HALF_UP).toPlainString(),
                actual.getBasePrice().setScale(0, RoundingMode.HALF_UP).toPlainString(),
                same(expected.basePrice(), actual.getBasePrice())));

        report.append(row("Ветка",
                expected.branch(),
                actual.getBranch(),
                expected.branch().equals(actual.getBranch())));

        report.append(row("Базовая цена с НДС (тираж 10–49), ₽",
                String.valueOf(expected.basePriceWithVat()),
                actual.getBasePriceWithVAT().toPlainString(),
                expected.basePriceWithVat() == actual.getBasePriceWithVAT().intValue()));

        report.append("\n### Цены по тиражам\n\n");
        report.append("| Тираж | Прототип: без НДС | Прототип: с НДС | Прототип: итог | ")
                .append("React: без НДС | React: с НДС | React: итог | Совпадает? |\n");
        report.append("|---|---:|---:|---:|---:|---:|---:|:---:|\n");

        for (int i = 0; i < expected.prices().size(); i++) {
            ExpectedPrice expectedPrice = expected.prices().get(i);
            PriceRowDto actualPrice = actual.getPrices().get(i);
            boolean matches = same(expectedPrice.withoutVat(), actualPrice.getWithoutVAT())
                    && expectedPrice.calculatedPrice() == actualPrice.getCalculatedPrice()
                    && expectedPrice.priceListPrice() == actualPrice.getPriceListPrice()
                    && expectedPrice.finalPrice() == actualPrice.getFinalPrice();
            report.append("| ").append(expectedPrice.label())
                    .append(" | ").append(expectedPrice.withoutVat().toPlainString())
                    .append(" | ").append(expectedPrice.calculatedPrice())
                    .append(" | ").append(expectedPrice.finalPrice())
                    .append(" | ").append(actualPrice.getWithoutVAT().toPlainString())
                    .append(" | ").append(actualPrice.getCalculatedPrice())
                    .append(" | ").append(actualPrice.getFinalPrice())
                    .append(" | ").append(mark(matches))
                    .append(" |\n");
        }

        // Isolate the pricing stage: feed the prototype cost (80) into the
        // current PriceCalculator and compare all seven tiers.
        List<PriceCalculator.PriceRow> isolatedRows = new PriceCalculator(new PricingConfig())
                .generatePrices(new BigDecimal("80"), request.getPriceList(), request.getMarginValue());
        int isolatedMatches = 0;
        for (int i = 0; i < expected.prices().size(); i++) {
            ExpectedPrice expectedPrice = expected.prices().get(i);
            PriceCalculator.PriceRow actualPrice = isolatedRows.get(i);
            boolean matches = same(expectedPrice.withoutVat(), actualPrice.getWithoutVAT())
                    && expectedPrice.calculatedPrice() == actualPrice.getCalculatedPrice()
                    && expectedPrice.priceListPrice() == actualPrice.getPriceListPrice()
                    && expectedPrice.finalPrice() == actualPrice.getFinalPrice();
            if (matches) {
                isolatedMatches++;
            }
        }
        report.append("\n### Изолированная проверка `generatePrices` (на эталонной себестоимости 80)\n\n");
        report.append("Совпало строк прайса: **").append(isolatedMatches).append(" из 7** (")
                .append(isolatedMatches == 7 ? "логика коэффициентов и прайса корректна" : "есть ошибка в прайсе")
                .append(").\n");

        return report.toString();
    }

    private static String row(String parameter, String prototypeValue, String actualValue, boolean matches) {
        return "| " + parameter + " | " + prototypeValue + " | " + actualValue + " | " + mark(matches) + " |\n";
    }

    private static String mark(boolean matches) {
        return matches ? "✅" : "❌";
    }

    private static boolean same(BigDecimal left, BigDecimal right) {
        return left.compareTo(right) == 0;
    }

    private static boolean same(double left, double right) {
        return Math.abs(left - right) < 0.000000001;
    }

    private static String money(double value) {
        return String.format(Locale.ROOT, "%.2f", value);
    }

    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }


    private static DetailDto findDetail(CalculationRequest request, String name) {
        return request.getDetails().stream()
                .filter(detail -> name.equals(detail.getName()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Detail not found: " + name));
    }

    /**
     * Mirrors CostCalculator for one detail, using the print value returned by
     * the current pipeline. This snapshot has a single printed detail, so the
     * response's reference print cost applies to it directly.
     */
    private static double actualDetailCost(
            DetailDto detail, CalculationRequest request, CalculationResponse actual) {
        double cost = detail.getSheetPrice().doubleValue()
                / detail.getCountOnSheet().doubleValue()
                + request.getWorkPrice().doubleValue();

        if (detail.getOperations() != null) {
            for (Map.Entry<String, Boolean> entry : detail.getOperations().entrySet()) {
                if (Boolean.TRUE.equals(entry.getValue())) {
                    cost += request.getExtras().stream()
                            .filter(extra -> entry.getKey().equals(extra.getName()))
                            .mapToDouble(extra -> extra.getCost().doubleValue())
                            .findFirst()
                            .orElse(0);
                }
            }
        }

        if (Boolean.TRUE.equals(detail.getIsPrinted())
                && Boolean.TRUE.equals(request.getPrintSettings().getEnabled())) {
            cost += actual.getPrintCostPerUnit().doubleValue();
        }

        return cost;
    }

    private static Path findProjectRoot() {
        Path current = Paths.get("").toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("Паллена 9 Тест.json"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Project root with 'Паллена 9 Тест.json' not found");
    }

    private record ExpectedDetail(
            String name, double material, double work, double operations, double print, double total) {
    }

    private record ExpectedPrice(
            String label, BigDecimal withoutVat, int calculatedPrice, int priceListPrice, int finalPrice) {
    }

    private record Expected(
            double printPerUnit,
            double total,
            BigDecimal basePrice,
            String branch,
            int basePriceWithVat,
            List<ExpectedDetail> details,
            List<ExpectedPrice> prices) {
    }

}

