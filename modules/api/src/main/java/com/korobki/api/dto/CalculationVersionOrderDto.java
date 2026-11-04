package com.korobki.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Заказ, выросший из версии расчёта (для дерева версий).
 *
 * <p>Заказчик может выбрать версию и через неделю вернуться к ней снова, поэтому
 * у одной версии бывает несколько заказов — в дереве они показываются метками
 * рядом с версией-источником.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CalculationVersionOrderDto {

    /** Идентификатор заказа. */
    private UUID id;

    /** Номер заказа для показа. */
    private String number;
}
