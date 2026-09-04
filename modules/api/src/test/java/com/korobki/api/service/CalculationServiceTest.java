package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.repository.CalculationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CalculationServiceTest {

    private CalculationRepository repository;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        service = new CalculationService(repository, new ObjectMapper());
    }

    private CalculationSaveRequest validRequest() {
        CalculationSaveRequest request = new CalculationSaveRequest();
        request.setName("Расчёт 1");
        request.setClientName("ООО Ромашка");
        request.setManagerName("Иванов");

        com.korobki.api.dto.CalculationRequest calc = new com.korobki.api.dto.CalculationRequest();
        calc.setConstruction("Этне 2 (шубер)");
        calc.setWorkPrice(new BigDecimal("5"));
        request.setCalculation(calc);
        return request;
    }

    @Test
    void save_persistsAllFields() {
        when(repository.save(any())).thenAnswer(inv -> {
            Calculation c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        CalculationDto dto = service.save(validRequest());

        assertEquals("Расчёт 1", dto.getName());
        assertEquals("ООО Ромашка", dto.getClientName());
        assertEquals("Иванов", dto.getManagerName());
        assertEquals("draft", dto.getStatus());
        assertEquals("Этне 2 (шубер)", dto.getCalculation().get("construction"));
    }

    @Test
    void list_returnsDtosSortedByRepository() {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setName("Расчёт 2");
        calculation.setClientName("Клиент");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("draft");
        when(repository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(calculation));

        List<CalculationDto> result = service.list();

        assertEquals(1, result.size());
        assertEquals("Расчёт 2", result.get(0).getName());
    }

    @Test
    void get_existingId_returnsDto() {
        Calculation calculation = new Calculation();
        calculation.setId(UUID.randomUUID());
        calculation.setName("Расчёт 3");
        calculation.setClientName("Клиент");
        calculation.setManagerName("Менеджер");
        calculation.setStatus("ready");
        when(repository.findById(calculation.getId())).thenReturn(Optional.of(calculation));

        CalculationDto dto = service.get(calculation.getId());

        assertEquals("ready", dto.getStatus());
    }

    @Test
    void get_missingId_throws() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.get(id));
    }

    @Test
    void delete_callsRepository() {
        UUID id = UUID.randomUUID();
        service.delete(id);
        verify(repository).deleteById(id);
    }
}
