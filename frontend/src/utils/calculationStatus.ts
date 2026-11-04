// frontend/src/utils/calculationStatus.ts
import type { SavedCalculation } from '../types';

/** Человекочитаемые названия статусов расчёта и заказа. */
export const STATUS_LABELS: Record<SavedCalculation['status'], string> = {
    draft: 'Черновик',
    ready: 'Готов',
    sent: 'Отправлен',
    in_work: 'В работе',
    closed: 'Закрыт',
};

/** Цвета тегов статусов: черновик нейтральный, закрытый — красный. */
export const STATUS_COLORS: Record<SavedCalculation['status'], string> = {
    draft: 'default',
    ready: 'processing',
    sent: 'warning',
    in_work: 'success',
    closed: 'red',
};

/** Варианты для Select статуса. */
export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as SavedCalculation['status'][])
    .map((value) => ({ value, label: STATUS_LABELS[value] }));
