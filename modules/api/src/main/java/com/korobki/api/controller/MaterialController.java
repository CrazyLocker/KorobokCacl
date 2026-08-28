package com.korobki.api.controller;

import com.korobki.calculator.service.MaterialService;
import com.korobki.persistence.entity.Material;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/materials")
@RequiredArgsConstructor
public class MaterialController {

    private final MaterialService materialService;

    @GetMapping
    public List<Material> getAllMaterials() {
        return materialService.getAllActiveMaterials();
    }
}