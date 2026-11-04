// frontend/src/utils/stateSignature.ts

/**
 * Подпись состояния калькулятора для отслеживания несохранённых правок.
 *
 * <p>Сравнивается с подписью последнего сохранённого (или только что
 * загруженного) состояния: расхождение означает, что пользователь что-то
 * изменил и закрытие вкладки потеряет его работу.
 */
export function stateSignature(state: unknown): string {
    return JSON.stringify(state);
}

/** Есть ли расхождение с последним сохранённым состоянием. */
export function hasUnsavedChanges(cleanSignature: string | null, current: unknown): boolean {
    // Пока состояние ни разу не зафиксировано, сравнивать не с чем: это не
    // «несохранённая правка», а ещё не загруженный калькулятор.
    if (cleanSignature === null || cleanSignature === '') return false;
    return cleanSignature !== stateSignature(current);
}
