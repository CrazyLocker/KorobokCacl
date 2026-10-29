package com.korobki.api.controller;

import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.dto.ErrorResponse;
import com.korobki.api.exception.GlobalExceptionHandler;
import com.korobki.api.exception.NotFoundException;
import com.korobki.api.service.CalculationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Проверяет контракт {@code GET /api/calculations/{id}/view}: существующий
 * расчёт отдаётся с 200, отсутствующий — 404 через глобальный обработчик.
 */
class CalculationControllerViewTest {

    private CalculationService calculationService;
    private CalculationController controller;

    @BeforeEach
    void setUp() {
        calculationService = mock(CalculationService.class);
        controller = new CalculationController(calculationService);
    }

    @Test
    void view_existingCalculation_returnsOk() {
        UUID id = UUID.randomUUID();
        CalculationViewDto view = new CalculationViewDto();
        view.setId(id);
        view.setName("Расчёт 1");
        view.setResult(new CalculationResponse());
        when(calculationService.view(id)).thenReturn(view);

        ResponseEntity<CalculationViewDto> entity = controller.view(id);

        assertEquals(HttpStatus.OK, entity.getStatusCode());
        assertNotNull(entity.getBody());
        assertEquals(id, entity.getBody().getId());
        assertNotNull(entity.getBody().getResult());
    }

    @Test
    void view_missingCalculation_propagatesNotFound() {
        UUID id = UUID.randomUUID();
        when(calculationService.view(id)).thenThrow(new NotFoundException("Calculation not found: " + id));

        assertThrows(NotFoundException.class, () -> controller.view(id));
    }

    @Test
    void notFoundException_mappedToHttp404() {
        ErrorResponse body = new GlobalExceptionHandler()
                .handleNotFound(new NotFoundException("Calculation not found: 42"))
                .getBody();

        assertNotNull(body);
        assertEquals(HttpStatus.NOT_FOUND.value(), body.getStatus());
        assertEquals("Calculation not found: 42", body.getErrors().get("error"));
    }
}
