// frontend/src/api/adminAuth.ts

/** Учётные данные администратора для изменяющих запросов. */
export interface AdminCredentials {
    user: string;
    password: string;
}

const STORAGE_KEY = 'webcalc.adminAuth';

/**
 * Одна учётная запись на сессию вкладки.
 *
 * <p>Чтение справочников открыто, а сохранение, удаление и импорт требуют
 * роли ADMIN: пароль спрашивается один раз перед первым опасным действием и
 * живёт в sessionStorage до закрытия вкладки.
 */
export function getAdminAuth(): AdminCredentials | null {
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return null;
        const { user, password } = parsed as Partial<AdminCredentials>;
        if (typeof user !== 'string' || typeof password !== 'string') return null;
        return { user, password };
    } catch {
        return null;
    }
}

/** Запоминает пароль администратора до закрытия вкладки. */
export function setAdminAuth(credentials: AdminCredentials): void {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

/** Забывает пароль (после отказа сервера). */
export function clearAdminAuth(): void {
    window.sessionStorage.removeItem(STORAGE_KEY);
}

/** true, если запрос что-то меняет и требует роли ADMIN. */
export function isMutatingRequest(method?: string): boolean {
    const verb = (method ?? 'get').toLowerCase();
    return verb !== 'get' && verb !== 'head' && verb !== 'options';
}

/** Заголовок Basic-аутентификации или null, если пароль ещё не введён. */
export function adminAuthHeader(): Record<string, string> | null {
    const credentials = getAdminAuth();
    if (!credentials) return null;
    // btoa не умеет кириллицу в логине: кодируем UTF-8 вручную.
    const bytes = new TextEncoder().encode(`${credentials.user}:${credentials.password}`);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return { Authorization: `Basic ${window.btoa(binary)}` };
}

/** true, если сервер ответил 401 — пароль неверен или не задан. */
export function isUnauthorized(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const response = (error as { response?: { status?: number } }).response;
    return response?.status === 401;
}
