package com.korobki.api.service;

import com.korobki.api.dto.CustomerDto;
import com.korobki.api.dto.CustomerSaveRequest;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяет справочник клиентов: имя — естественный ключ без учёта регистра,
 * переименование доезжает до сохранённых расчётов, чужое имя не отбирается.
 */
class CustomerServiceTest {

    private CustomerRepository customerRepository;
    private CalculationRepository calculationRepository;
    private CustomerService service;

    @BeforeEach
    void setUp() {
        customerRepository = mock(CustomerRepository.class);
        calculationRepository = mock(CalculationRepository.class);
        service = new CustomerService(customerRepository, calculationRepository);
    }

    /** Клиент с заданным именем. */
    private Customer customer(String name) {
        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setName(name);
        customer.setActive(true);
        return customer;
    }

    /** Запрос создания/переименования. */
    private CustomerSaveRequest request(String name) {
        CustomerSaveRequest request = new CustomerSaveRequest();
        request.setName(name);
        return request;
    }

    @Test
    void create_duplicateName_isRejected() {
        when(customerRepository.findByNameIgnoreCase("Ромашка")).thenReturn(Optional.of(customer("Ромашка")));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.create(request("Ромашка")));

        assertTrue(error.getMessage().contains("уже есть в справочнике"), error.getMessage());
        verify(customerRepository, never()).save(any());
    }

    @Test
    void create_trimsNameAndKeepsOptionalsEmpty() {
        when(customerRepository.findByNameIgnoreCase("Ромашка")).thenReturn(Optional.empty());
        when(customerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CustomerDto created = service.create(request("  Ромашка  "));

        assertEquals("Ромашка", created.getName());
        assertTrue(created.isActive());
    }

    @Test
    void update_renameIsCopiedIntoStoredCalculations() {
        Customer existing = customer("Ромашка");
        when(customerRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(customerRepository.findByNameIgnoreCase("Ромашка плюс")).thenReturn(Optional.empty());

        CustomerDto updated = service.update(existing.getId(), request("Ромашка плюс"));

        assertEquals("Ромашка плюс", updated.getName());
        verify(calculationRepository).renameCustomerCalculations(existing.getId(), "Ромашка плюс");
    }

    @Test
    void update_sameName_doesNotTouchCalculations() {
        Customer existing = customer("Ромашка");
        when(customerRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(customerRepository.findByNameIgnoreCase("Ромашка")).thenReturn(Optional.of(existing));

        service.update(existing.getId(), request("Ромашка"));

        verify(calculationRepository, never()).renameCustomerCalculations(any(), any());
    }

    @Test
    void update_nameOfAnotherClient_isRejected() {
        Customer existing = customer("Ромашка");
        Customer other = customer("Лютик");
        when(customerRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(customerRepository.findByNameIgnoreCase("Лютик")).thenReturn(Optional.of(other));

        assertThrows(IllegalArgumentException.class,
                () -> service.update(existing.getId(), request("Лютик")));
    }

    @Test
    void update_missingClient_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(customerRepository.findById(id)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.update(id, request("Ромашка")));
    }
}
