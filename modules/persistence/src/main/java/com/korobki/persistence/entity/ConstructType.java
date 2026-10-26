package com.korobki.persistence.entity;

/**
 * Box construction type.
 * <p>Used to group models and to order the reference book.
 * The list is extended when a new construction family is added.</p>
 */
public enum ConstructType {
    ELARA,
    PALLENA,
    EGEON,
    HIMALAYA,
    NEREIDA,
    ETNE,
    ATLAS,
    CUSTOM,
    /** «Индивидуальная» — своя конфигурация, состав задан в справочнике. */
    INDIVIDUAL,
    /** «Кашированная» — каркас из картона с кашированным покрытием. */
    LAMINATED
}
