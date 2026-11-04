// frontend/src/components/common/adminGateContext.ts
import { createContext, useCallback, useContext } from 'react';
import { App as AntdApp } from 'antd';
import { clearAdminAuth, isUnauthorized } from '../../api/adminAuth';

/** Что умеет контекст пароля администратора. */
export interface AdminGateValue {
    /** Спрашивает пароль, если он ещё не введён; false — пользователь отказался. */
    ensureAdmin: () => Promise<boolean>;
}

/** Контекст пароля администратора; вне провайдера всегда отказывает. */
export const AdminGateContext = createContext<AdminGateValue>({ ensureAdmin: async () => false });

/**
 * Доступ к запросу пароля администратора.
 *
 * @returns функция проверки пароля
 */
export const useAdminGate = (): AdminGateValue => useContext(AdminGateContext);

/**
 * Оборачивает опасное действие запросом пароля и понятной ошибкой 401.
 *
 * @param onNotify уведомления страницы
 * @returns функция запуска действия; false — пароль не введён или отклонён
 */
export function useAdminAction(
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void,
): (action: () => Promise<void>) => Promise<boolean> {
    const { ensureAdmin } = useAdminGate();
    return useCallback(
        async (action: () => Promise<void>) => {
            if (!(await ensureAdmin())) return false;
            try {
                await action();
                return true;
            } catch (error) {
                if (isUnauthorized(error)) {
                    clearAdminAuth();
                    onNotify('Неверный пароль администратора', 'error');
                    return false;
                }
                throw error;
            }
        },
        [ensureAdmin, onNotify],
    );
}

/** Пробрасывает уведомления antd в компоненты. */
export const useNotify = (): ((message: string, severity?: 'success' | 'error' | 'info') => void) => {
    const { message } = AntdApp.useApp();
    return useCallback(
        (text: string, severity: 'success' | 'error' | 'info' = 'info') => {
            message[severity](text);
        },
        [message],
    );
};
