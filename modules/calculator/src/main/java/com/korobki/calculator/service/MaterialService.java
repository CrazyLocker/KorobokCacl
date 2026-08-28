package com.korobki.calculator.service;

import com.korobki.persistence.entity.Material;
import com.korobki.persistence.repository.MaterialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MaterialService {

    private final MaterialRepository materialRepository;

    public List<Material> getAllActiveMaterials() {
        return materialRepository.findAllByIsActiveTrue();
    }

    public Material getMaterialById(UUID id) {
        return materialRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Material not found with id: " + id));
    }

    public BigDecimal getSheetPrice(String materialType, BigDecimal purchasePrice) {
        Material.MaterialType type = Material.MaterialType.valueOf(materialType);
        if (type == Material.MaterialType.coated) {
            // Для мелованного картона цена фиксированная
            return materialRepository.findByTypeAndMinPurchasePriceLessThanEqualAndMaxPurchasePriceGreaterThanEqual(
                            type, BigDecimal.ZERO, BigDecimal.ZERO)
                    .stream()
                    .findFirst()
                    .map(Material::getPricePerSheet)
                    .orElseThrow(() -> new RuntimeException("Coated material not found"));
        } else {
            // Для дизайнерского картона цена зависит от закупочной
            return materialRepository.findByTypeAndMinPurchasePriceLessThanEqualAndMaxPurchasePriceGreaterThanEqual(
                            type, purchasePrice, purchasePrice)
                    .stream()
                    .findFirst()
                    .map(Material::getPricePerSheet)
                    .orElseThrow(() -> new RuntimeException("Designer material not found for price: " + purchasePrice));
        }
    }
}