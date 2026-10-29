package com.korobki.api.dto;

/**
 * Длина одного элемента контура ножа.
 *
 * @param type         тип элемента: line, rect, circle, ellipse, polyline, polygon, path
 * @param lengthPx     длина в пользовательских единицах (px) с учётом transform
 * @param lengthMm     длина в миллиметрах
 * @param hasTransform был ли у самого элемента атрибут {@code transform}
 */
public record KnifeElementDto(String type, double lengthPx, double lengthMm, boolean hasTransform) {
}