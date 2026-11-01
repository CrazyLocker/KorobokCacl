package com.korobki.api.controller;

import com.korobki.api.dto.CalculationDto;
import com.korobki.api.dto.CalculationRequest;
import com.korobki.api.dto.CalculationSaveRequest;
import com.korobki.api.dto.CalculationViewDto;
import com.korobki.api.dto.CalculationVersionDto;
import com.korobki.api.dto.CustomerTreeDto;
import com.korobki.api.service.CalculationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for saved calculations (CRUD).
 */
@RestController
@RequestMapping("/api/calculations")
@RequiredArgsConstructor
public class CalculationController {

    private final CalculationService calculationService;

    /**
     * Saves a new calculation.
     *
     * @param request calculation data (name, client, manager, state)
     * @return the saved calculation
     */
    @PostMapping("/save")
    public ResponseEntity<CalculationDto> save(@Valid @RequestBody CalculationSaveRequest request) {
        return ResponseEntity.ok(calculationService.save(request));
    }

    /**
     * Saves an edited calculation as the next version of its chain.
     *
     * <p>Metadata (name, client, manager) is inherited from the parent version,
     * so the body carries only the calculation itself. The order, however, is a
     * decision of the moment: {@code orderId} moves the new version into
     * another order, {@code detachOrder} takes it out of any order, and with
     * neither the parent order is inherited.
     *
     * @param id          identifier of the version being edited
     * @param request     edited calculation request
     * @param orderId     order to move the new version into, may be null
     * @param detachOrder true to leave the version without an order
     * @return the saved version
     */
    @PostMapping("/{id}/iterate")
    public ResponseEntity<CalculationDto> iterate(
            @PathVariable UUID id,
            @Valid @RequestBody CalculationRequest request,
            @RequestParam(required = false) UUID orderId,
            @RequestParam(defaultValue = "false") boolean detachOrder) {
        return ResponseEntity.ok(calculationService.iterate(id, request, orderId, detachOrder));
    }

    /**
     * Lists all saved calculations, newest first.
     *
     * @return list of saved calculations
     */
    @GetMapping("/list")
    public ResponseEntity<List<CalculationDto>> list() {
        return ResponseEntity.ok(calculationService.list());
    }

    /**
     * Returns the customer → order → calculation tree for the list screen.
     *
     * <p>Calculations without an order are grouped in {@code withoutOrder} of
     * their client; rows saved before the reference book existed fall into a
     * bucket with a null client id.
     *
     * @return clients with their orders and calculations
     */
    @GetMapping("/tree")
    public ResponseEntity<List<CustomerTreeDto>> tree() {
        return ResponseEntity.ok(calculationService.tree());
    }

    /**
     * Returns a saved calculation by its identifier.
     *
     * @param id calculation identifier
     * @return the calculation
     */
    @GetMapping("/{id}")
    public ResponseEntity<CalculationDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(calculationService.get(id));
    }

    /**
     * Returns the version tree of a saved calculation, parents before children.
     *
     * <p>The response is flat: every entry carries {@code parentId}, so the
     * client can render the tree with its branches. Deleted versions stay in
     * the response marked {@code deleted}.
     *
     * @param id identifier of any version of the tree
     * @return versions of the tree
     */
    @GetMapping("/{id}/versions")
    public ResponseEntity<List<CalculationVersionDto>> versions(@PathVariable UUID id) {
        return ResponseEntity.ok(calculationService.versions(id));
    }

    /**
     * Returns a read-only view of a saved calculation: metadata, the stored
     * request and the result recomputed from it.
     *
     * @param id calculation identifier
     * @return calculation view
     */
    @GetMapping("/{id}/view")
    public ResponseEntity<CalculationViewDto> view(@PathVariable UUID id) {
        return ResponseEntity.ok(calculationService.view(id));
    }

    /**
     * Marks a version and its subtree as deleted.
     *
     * <p>Nothing is removed: the history is kept for the agreement with the
     * client and the tree shows the version struck through.
     *
     * @param id version to delete together with its descendants
     * @return empty response
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        calculationService.delete(id);
        return ResponseEntity.ok().build();
    }
}
