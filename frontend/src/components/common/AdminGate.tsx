// frontend/src/components/common/AdminGate.tsx
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Form, Input, Modal } from 'antd';
import { checkAdminAuth } from '../../api/calculatorApi';
import { getAdminAuth, setAdminAuth } from '../../api/adminAuth';
import { AdminGateContext } from './adminGateContext';

interface CredentialsForm {
    user: string;
    password: string;
}

/**
 * Держит одну учётную запись администратора на вкладку.
 *
 * <p>Пароль спрашивается перед первым опасным действием и проверяется запросом
 * {@code GET /api/auth/me}: так пользователь узнаёт о неверном пароле до того,
 * как нажмёт «Удалить из базы». Пароль живёт в sessionStorage до закрытия
 * вкладки, а сервер по-прежнему требует его на каждом изменяющем запросе.
 *
 * @param props дети приложения
 */
export function AdminGateProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const pendingRef = useRef<{ resolve: (ok: boolean) => void } | null>(null);
    const [form] = Form.useForm<CredentialsForm>();

    const ensureAdmin = useCallback(() => {
        if (getAdminAuth()) return Promise.resolve(true);
        return new Promise<boolean>((resolve) => {
            pendingRef.current?.resolve(false);
            pendingRef.current = { resolve };
            form.resetFields();
            setError(null);
            setOpen(true);
        });
    }, [form]);

    const finish = useCallback((ok: boolean) => {
        pendingRef.current?.resolve(ok);
        pendingRef.current = null;
        setOpen(false);
    }, []);

    const submit = async () => {
        const values = await form.validateFields();
        setChecking(true);
        const ok = await checkAdminAuth(values.user.trim(), values.password);
        setChecking(false);
        if (!ok) {
            setError('Неверный логин или пароль');
            return;
        }
        setAdminAuth({ user: values.user.trim(), password: values.password });
        finish(true);
    };

    const value = useMemo(() => ({ ensureAdmin }), [ensureAdmin]);

    return (
        <AdminGateContext.Provider value={value}>
            {children}
            <Modal
                open={open}
                title="Пароль администратора"
                okText="Войти"
                cancelText="Отмена"
                confirmLoading={checking}
                onOk={submit}
                onCancel={() => finish(false)}
                destroyOnHidden
            >
                <Alert
                    type="info"
                    showIcon
                    message="Сохранение, удаление и импорт требуют роли администратора."
                    description="Пароль спрашивается один раз и действует до закрытия вкладки."
                    style={{ marginBottom: 16 }}
                />
                {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
                <Form form={form} layout="vertical" requiredMark={false} initialValues={{ user: 'admin' }}>
                    <Form.Item name="user" label="Логин" rules={[{ required: true, message: 'Укажите логин' }]}>
                        <Input autoComplete="username" />
                    </Form.Item>
                    <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Укажите пароль' }]}>
                        <Input.Password autoComplete="current-password" onPressEnter={submit} />
                    </Form.Item>
                </Form>
            </Modal>
        </AdminGateContext.Provider>
    );
}
