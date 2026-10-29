package com.korobki.api.controller;

import com.korobki.api.dto.KnifeRequest;
import com.korobki.api.dto.KnifeResponse;
import com.korobki.calculator.service.KnifeCalculator;
import com.korobki.core.config.PricingConfig;
import com.korobki.persistence.repository.KnifeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * Проверяет, что результат разбора доезжает до ответа API:
 * DOCTYPE-файлы считаются, а битый XML даёт HTTP 200 + {@code parseError} вместо молчаливых нулей.
 */
class KnifeControllerTest {

    private static final double EPS = 1e-6;

    private KnifeController controller;

    @BeforeEach
    void setUp() {
        PricingConfig pricingConfig = new PricingConfig();
        pricingConfig.setKnifePricePerMm(new BigDecimal("3.0"));
        pricingConfig.setKnifeBaseCost(new BigDecimal("500.0"));
        controller = new KnifeController(new KnifeCalculator(pricingConfig), mock(KnifeRepository.class));
    }

    private KnifeRequest request(String svgContent) {
        KnifeRequest request = new KnifeRequest();
        request.setSvgContent(svgContent);
        return request;
    }

    @Test
    void doctypeSvg_returnsLengthsWithoutParseError() {
        KnifeResponse response = controller.calculate(request(
                "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\""
                        + " \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">"
                        + "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100mm\" height=\"100mm\""
                        + " viewBox=\"0 0 100 100\"><line x1=\"0\" y1=\"0\" x2=\"100\" y2=\"0\"/></svg>"))
                .getBody();

        assertNotNull(response);
        assertNull(response.getParseError());
        assertEquals(100, response.getTotalLengthMm(), EPS);
        assertEquals(1, response.getElements().size());
    }

    @Test
    void brokenSvg_returnsHttp200WithParseError() {
        ResponseEntity<KnifeResponse> entity = controller.calculate(request("<svg><line x1=\"0\""));

        assertEquals(HttpStatus.OK, entity.getStatusCode());
        KnifeResponse response = entity.getBody();
        assertNotNull(response);
        assertNotNull(response.getParseError());
        assertEquals(0, response.getTotalLengthPx(), EPS);
        assertEquals(0, response.getKnifeCost(), EPS);
        assertTrue(response.getElements().isEmpty());
        assertNull(response.getScaleSource());
    }
}
