package com.korobki.api.controller;

import com.korobki.api.dto.CustomerDto;
import com.korobki.api.dto.CustomerSaveRequest;
import com.korobki.api.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for the client reference book.
 */
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    /**
     * Lists clients of the reference book, active first.
     *
     * @return clients
     */
    @GetMapping
    public ResponseEntity<List<CustomerDto>> list() {
        return ResponseEntity.ok(customerService.list());
    }

    /**
     * Creates a client.
     *
     * @param request name and contact details
     * @return the stored client
     */
    @PostMapping
    public ResponseEntity<CustomerDto> create(@Valid @RequestBody CustomerSaveRequest request) {
        return ResponseEntity.ok(customerService.create(request));
    }

    /**
     * Updates a client; a rename is copied into its stored calculations.
     *
     * @param id      client identifier
     * @param request new values
     * @return the updated client
     */
    @PutMapping("/{id}")
    public ResponseEntity<CustomerDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerSaveRequest request) {
        return ResponseEntity.ok(customerService.update(id, request));
    }
}
