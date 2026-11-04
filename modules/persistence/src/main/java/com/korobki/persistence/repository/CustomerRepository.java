package com.korobki.persistence.repository;

import com.korobki.persistence.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for the client reference book.
 */
public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    /**
     * Lists clients alphabetically, active ones first.
     *
     * @return every client of the reference book
     */
    List<Customer> findAllByOrderByActiveDescNameAsc();

    /**
     * Finds a client by name ignoring case, so "Тавасиева" and "тавасиева" are
     * the same client.
     *
     * @param name client name
     * @return the client when present
     */
    Optional<Customer> findByNameIgnoreCase(String name);
}
