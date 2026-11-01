package com.korobki.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.korobki.api.controller.CalculatorService;
import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationResponse;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Calculation;
import com.korobki.persistence.entity.CalculationOrder;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationOrderRepository;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяет сохранение итерации: правка создаёт ребёнка той версии, из которой
 * её открыли, поэтому дерево ветвится, а не вытягивается в одну линию.
 * Метаданные наследуются от родителя, родительская строка не меняется, а
 * расчёт, который не считается, не сохраняется.
 */
class CalculationServiceIterateTest {

    private CalculationRepository repository;
    private CustomerRepository customerRepository;
    private CalculationOrderRepository orderRepository;
    private CalculatorService calculatorService;
    private CalculationService service;

    @BeforeEach
    void setUp() {
        repository = mock(CalculationRepository.class);
        customerRepository = mock(CustomerRepository.class);
        orderRepository = mock(CalculationOrderRepository.class);
        calculatorService = mock(CalculatorService.class);

        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName("ООО Ромашка");
        when(customerRepository.findByNameIgnoreCase(any())).thenReturn(Optional.of(customer));
        when(customerRepository.findById(any())).thenReturn(Optional.of(customer));

        service = new CalculationService(
                repository, customerRepository, orderRepository, new ObjectMapper(), calculatorService);
    }

    private Calculation parent(int version) {
        Calculation parent = new Calculation();
        parent.setId(UUID.randomUUID());
        parent.setRootId(UUID.randomUUID());
        parent.setVersion(version);
        parent.setName("Коробка для часов");
        parent.setClientName("ООО Ромашка");
        parent.setManagerName("Иванов");
        parent.setStatus("ready");
        when(repository.findById(parent.getId())).thenReturn(Optional.of(parent));
        return parent;
    }

    private CalculationRequest editedRequest() {
        CalculationRequest request = new CalculationRequest();
        request.setConstruction("Этне 2 (шубер)");
        request.setWorkPrice(new BigDecimal("6"));
        return request;
    }

    private void stubCalculatorAndSave() {
        CalculationResponse response = new CalculationResponse();
        response.setTotalCost(new BigDecimal("200"));
        when(calculatorService.calculate(any())).thenReturn(response);
        when(repository.save(any())).thenAnswer(inv -> {
            Calculation c = inv.getArgument(0);
            if (c.getId() == null) {
                c.setId(UUID.randomUUID());
            }
            return c;
        });
    }

    @Test
    void iterate_createsChildOfEditedVersion() {
        stubCalculatorAndSave();
        Calculation parent = parent(1);

        CalculationDto dto = service.iterate(parent.getId(), editedRequest(), null, false);

        assertEquals(2, dto.getVersion());
        assertEquals(parent.getRootId(), dto.getRootId());

        Calculation saved = captureSaved();
        assertEquals(parent.getId(), saved.getParentId(), "новая версия цепляется за редактируемую");
    }

    @Test
    void iterate_fromOldVersion_branchesUnderItInsteadOfAppending() {
        stubCalculatorAndSave();
        Calculation third = parent(3);

        CalculationDto dto = service.iterate(third.getId(), editedRequest(), null, false);

        assertEquals(4, dto.getVersion(), "номер равен глубине ветки: родитель + 1");
        assertEquals(third.getId(), captureSaved().getParentId(),
                "правка версии 3 из пяти даёт подветку версии 3, а не версию 6 в конце");
    }

    @Test
    void iterate_inheritsMetadataFromParent() {
        stubCalculatorAndSave();
        Calculation parent = parent(1);

        CalculationDto dto = service.iterate(parent.getId(), editedRequest(), null, false);

        assertEquals("Коробка для часов", dto.getName());
        assertEquals("ООО Ромашка", dto.getClientName());
        assertEquals("Иванов", dto.getManagerName());
        assertEquals("ready", dto.getStatus());
    }

    @Test
    void iterate_deletedVersion_isRejected() {
        Calculation deleted = parent(2);
        deleted.setDeletedAt(LocalDateTime.now());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.iterate(deleted.getId(), editedRequest(), null, false));

        assertEquals("Версия помечена удалённой — её нельзя редактировать", ex.getMessage());
        verify(repository, never()).save(any());
        verify(calculatorService, never()).calculate(any());
    }

    @Test
    void iterate_storesRequestAndResultSnapshot() {
        stubCalculatorAndSave();
        Calculation parent = parent(1);

        service.iterate(parent.getId(), editedRequest(), null, false);

        Calculation saved = captureSaved();
        assertNotNull(saved.getCalculationState());
        assertEquals("Этне 2 (шубер)", saved.getCalculationState().get("construction"));
        assertNotNull(saved.getCalculationResult());
        assertNotNull(saved.getCalculationResult().get("totalCost"));
    }

    @Test
    void iterate_calculatorRejectsRequest_doesNotPersist() {
        when(calculatorService.calculate(any()))
                .thenThrow(new IllegalArgumentException("нет валидных деталей"));
        Calculation parent = parent(1);

        assertThrows(IllegalArgumentException.class,
                () -> service.iterate(parent.getId(), editedRequest(), null, false));

        verify(repository, never()).save(any());
    }

    @Test
    void iterate_missingCalculation_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.iterate(id, editedRequest(), null, false));
        verify(calculatorService, never()).calculate(any());
    }

    private Calculation captureSaved() {
        ArgumentCaptor<Calculation> captor = ArgumentCaptor.forClass(Calculation.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    /**
     * Клиент с заказом нужен, чтобы проверить перенос версии в заказ: заказ
     * принадлежит клиенту расчёта.
     */
    private Customer customerWithOrder(CalculationOrder order) {
        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName("ООО Ромашка");
        order.setId(UUID.randomUUID());
        order.setCustomerId(customer.getId());
        order.setNumber("2026-001");
        when(customerRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        return customer;
    }

    @Test
    void iterate_withOrderId_movesTheNewVersionIntoTheOrder() {
        stubCalculatorAndSave();
        CalculationOrder order = new CalculationOrder();
        Customer customer = customerWithOrder(order);
        Calculation parent = parent(3);
        parent.setCustomerId(customer.getId());

        CalculationDto dto = service.iterate(parent.getId(), editedRequest(), order.getId(), false);

        assertEquals(order.getId(), dto.getOrderId());
        assertEquals(customer.getId(), dto.getCustomerId());
        assertEquals(4, dto.getVersion());
        assertEquals(parent.getId(), captureSaved().getParentId());
    }

    @Test
    void iterate_detachOrder_leavesTheVersionWithoutOrder() {
        stubCalculatorAndSave();
        CalculationOrder order = new CalculationOrder();
        Customer customer = customerWithOrder(order);
        Calculation parent = parent(3);
        parent.setCustomerId(customer.getId());
        parent.setOrderId(order.getId());

        CalculationDto dto = service.iterate(parent.getId(), editedRequest(), null, true);

        assertEquals(null, dto.getOrderId());
        assertEquals(customer.getId(), dto.getCustomerId());
    }

    @Test
    void iterate_orderOfAnotherCustomer_isRejected() {
        stubCalculatorAndSave();
        CalculationOrder order = new CalculationOrder();
        Customer customer = customerWithOrder(order);
        order.setCustomerId(UUID.randomUUID());
        Calculation parent = parent(3);
        parent.setCustomerId(customer.getId());

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.iterate(parent.getId(), editedRequest(), order.getId(), false));

        assertEquals("Заказ принадлежит другому клиенту", error.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void iterate_parentWithoutCustomer_cannotBeMovedIntoOrder() {
        stubCalculatorAndSave();
        CalculationOrder order = new CalculationOrder();
        customerWithOrder(order);
        Calculation parent = parent(3);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.iterate(parent.getId(), editedRequest(), order.getId(), false));

        assertEquals("У расчёта не указан клиент — сначала выберите клиента", error.getMessage());
        verify(repository, never()).save(any());
    }
}
