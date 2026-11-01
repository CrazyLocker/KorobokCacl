package com.korobki.api.service;

import com.korobki.api.dto.CustomerDto;
import com.korobki.api.dto.CustomerSaveRequest;
import com.korobki.api.exception.NotFoundException;
import com.korobki.persistence.entity.Customer;
import com.korobki.persistence.repository.CalculationRepository;
import com.korobki.persistence.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Reference book of clients.
 *
 * <p>The name is the natural key: it is unique case-insensitively, because
 * managers type it by hand and "Ира" / "ира" must be the same client.
 */
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CalculationRepository calculationRepository;

    /**
     * Returns the reference book, active clients first.
     *
     * @return all clients
     */
    @Transactional(readOnly = true)
    public List<CustomerDto> list() {
        return customerRepository.findAllByOrderByActiveDescNameAsc().stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Creates a client.
     *
     * @param request name and contact details
     * @return stored client
     * @throws IllegalArgumentException when the name is already taken
     */
    @Transactional
    public CustomerDto create(CustomerSaveRequest request) {
        String name = request.getName().trim();
        customerRepository.findByNameIgnoreCase(name).ifPresent(existing -> {
            throw new IllegalArgumentException("Клиент «" + existing.getName() + "» уже есть в справочнике");
        });

        Customer customer = new Customer();
        customer.setName(name);
        customer.setInn(trimToNull(request.getInn()));
        customer.setContact(trimToNull(request.getContact()));
        if (request.getActive() != null) {
            customer.setActive(request.getActive());
        }
        return toDto(customerRepository.save(customer));
    }

    /**
     * Updates a client.
     *
     * <p>A rename is copied into the stored calculations of that client: the
     * calculations keep a denormalized client name so an old snapshot still
     * shows who the deal was for.
     *
     * @param id      client identifier
     * @param request new values
     * @return updated client
     * @throws NotFoundException        when the client does not exist
     * @throws IllegalArgumentException when the new name is taken by another client
     */
    @Transactional
    public CustomerDto update(UUID id, CustomerSaveRequest request) {
        Customer customer = find(id);
        String name = request.getName().trim();
        customerRepository.findByNameIgnoreCase(name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new IllegalArgumentException("Клиент «" + other.getName() + "» уже есть в справочнике");
                });

        boolean renamed = !name.equals(customer.getName());
        customer.setName(name);
        customer.setInn(trimToNull(request.getInn()));
        customer.setContact(trimToNull(request.getContact()));
        if (request.getActive() != null) {
            customer.setActive(request.getActive());
        }

        if (renamed) {
            calculationRepository.renameCustomerCalculations(id, name);
        }
        return toDto(customer);
    }

    /**
     * Loads a client or fails with a not-found error.
     *
     * @param id client identifier
     * @return stored client
     * @throws NotFoundException when the client does not exist
     */
    @Transactional(readOnly = true)
    public Customer find(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Клиент не найден: " + id));
    }

    /**
     * Maps a client entity to its DTO.
     *
     * @param customer stored client
     * @return client DTO
     */
    private CustomerDto toDto(Customer customer) {
        CustomerDto dto = new CustomerDto();
        dto.setId(customer.getId());
        dto.setName(customer.getName());
        dto.setInn(customer.getInn());
        dto.setContact(customer.getContact());
        dto.setActive(customer.isActive());
        dto.setCreatedAt(customer.getCreatedAt());
        dto.setUpdatedAt(customer.getUpdatedAt());
        return dto;
    }

    /**
     * Trims a nullable string, turning blanks into null.
     *
     * @param value raw value
     * @return trimmed value or null
     */
    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
