package com.korobki.api.controller;

import com.korobki.api.dto.KnifeDto;
import com.korobki.api.dto.KnifeRequest;
import com.korobki.api.dto.KnifeResponse;
import com.korobki.api.dto.KnifeSaveRequest;
import com.korobki.calculator.service.KnifeCalculator;
import com.korobki.persistence.entity.Knife;
import com.korobki.persistence.repository.KnifeRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for knife (die-cutting) calculations.
 * Accepts SVG content, parses geometric elements, and returns total length + cost.
 *
 * Formula: totalLengthMm × 3 + 500
 */
@RestController
@RequestMapping("/api/knife")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class KnifeController {

    private final KnifeCalculator knifeCalculator;
    private final KnifeRepository knifeRepository;

    @PostMapping("/calculate")
    public ResponseEntity<KnifeResponse> calculate(@RequestBody KnifeRequest request) {
        KnifeCalculator.KnifeResult result = knifeCalculator.calculate(request.getSvgContent());

        KnifeResponse response = new KnifeResponse();
        response.setTotalLengthPx(result.getTotalLengthPx());
        response.setTotalLengthMm(result.getTotalLengthMm());
        response.setKnifeCost(result.getKnifeCost());
        response.setScale(result.getScale());

        List<KnifeResponse.KnifeElement> elements = result.getDetails().stream().map(d -> {
            KnifeResponse.KnifeElement elem = new KnifeResponse.KnifeElement();
            elem.setType(d.getType());
            elem.setLengthPx(d.getLengthPx());
            elem.setLengthMm(d.getLengthMm());
            return elem;
        }).toList();
        response.setDetails(elements);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/save")
    public ResponseEntity<KnifeDto> save(@Valid @RequestBody KnifeSaveRequest request) {
        Knife knife = new Knife();
        knife.setName(request.getName());
        knife.setSvgContent(request.getSvgContent());
        knife.setTotalLengthMm(request.getTotalLengthMm());
        knife.setKnifeCost(request.getKnifeCost());
        knife.setClientName(request.getClientName());
        knife.setManagerName(request.getManagerName());

        Knife saved = knifeRepository.save(knife);
        return ResponseEntity.ok(toDto(saved));
    }

    @GetMapping("/list")
    public ResponseEntity<List<KnifeDto>> list() {
        return ResponseEntity.ok(knifeRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        knifeRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    private KnifeDto toDto(Knife knife) {
        KnifeDto dto = new KnifeDto();
        dto.setId(knife.getId());
        dto.setName(knife.getName());
        dto.setTotalLengthMm(knife.getTotalLengthMm());
        dto.setKnifeCost(knife.getKnifeCost());
        dto.setClientName(knife.getClientName());
        dto.setManagerName(knife.getManagerName());
        dto.setCreatedAt(knife.getCreatedAt());
        return dto;
    }
}
