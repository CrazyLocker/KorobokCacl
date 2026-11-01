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
     * Saves an edited calculation as the next version of the version being edited.
     *
     * <p>Metadata (name, client, manager) is inherited from the parent version,
     * so the body carries only the calculation itself. Editing v3 of a five
     * version chain branches from v3: the new version becomes v4 under v3,
     * while v4 and v5 of the old line stay untouched.
     *
     * @param id      identifier of the version being edited
     * @param request edited calculation request
     * @return the saved version
     */
    @PostMapping("/{id}/iterate")
    public ResponseEntity<CalculationDto> iterate(
            @PathVariable UUID id,
            @Valid @RequestBody CalculationRequest request) {
        return ResponseEntity.ok(calculationService.iterate(id, request));
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
     * Returns the customer → order/calculation tree for the list screen.
     *
     * <p>Calculation trees stay under their client even after an order is
     * placed: an order grows from one version and is listed separately with
     * that version as its source. Rows saved before the reference book existed
     * fall into a bucket with a null client id.
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

    /**
     * Erases a version and its subtree from the database.
     *
     * <p>This is the explicit "remove for good" action for branches that were
     * created by mistake: unlike {@link #delete(UUID)} nothing stays in the
     * history. A branch an order grew from is protected — the request fails
     * with the numbers of those orders.
     *
     * @param id version to erase together with its descendants
     * @return empty response
     */
    @DeleteMapping("/{id}/purge")
    public ResponseEntity<Void> purge(@PathVariable UUID id) {
        calculationService.purge(id);
        return ResponseEntity.ok().build();
    }
}
