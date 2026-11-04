// frontend/src/components/Settings/PurgeBlock.tsx
import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Flex, Spin, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { CalculationOrder, SavedCalculation } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { clearAdminAuth, isUnauthorized } from '../../api/adminAuth';
import { useAdminGate } from '../common/adminGateContext';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

const formatDate = (value?: string | null): string => {
    if (!value) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${day}.${month}.${year.slice(2)}`;
    }
    return new Date(value).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Блок «Удаление данных»: очистка базы от помеченных записей.
 *
 * <p>В дереве удаление — только пометка, строка остаётся зачёркнутой. Стереть
 * строку физически можно здесь и только здесь, причём лишь те записи, которые
 * уже помечены удалёнными: отметить живую версию или живой заказ нельзя.
 */
export const PurgeBlock = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const { ensureAdmin } = useAdminGate();
    const [loading, setLoading] = useState(false);
    const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
    const [orders, setOrders] = useState<CalculationOrder[]>([]);
    const [selectedCalculations, setSelectedCalculations] = useState<string[]>([]);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [allCalculations, allOrders] = await Promise.all([
                calculatorApi.listCalculations(),
                calculatorApi.listOrders(),
            ]);
            setCalculations(allCalculations.filter((calculation) => calculation.deleted));
            setOrders(allOrders.filter((order) => order.deleted));
            setSelectedCalculations([]);
            setSelectedOrders([]);
        } catch (err) {
            onNotify('Ошибка загрузки помеченных записей: ' + (err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [onNotify]);

    useEffect(() => {
        load();
    }, [load]);

    const purgeCalculations = () => {
        modal.confirm({
            title: `Удалить из базы расчёты: ${selectedCalculations.length}`,
            content: 'Строки исчезнут без возможности восстановления вместе со всей историей версий. '
                + 'Если из ветки вырос заказ, сначала удалите заказ.',
            okText: 'Удалить навсегда',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                if (!(await ensureAdmin())) return;
                try {
                    const deleted = await calculatorApi.purgeCalculations(selectedCalculations);
                    onNotify(`Удалено из базы расчётов: ${deleted}`, 'success');
                    load();
                } catch (err) {
                    if (isUnauthorized(err)) {
                        clearAdminAuth();
                        onNotify('Неверный пароль администратора', 'error');
                        return;
                    }
                    onNotify('Ошибка удаления: ' + (err as Error).message, 'error');
                }
            },
        });
    };

    const purgeOrders = () => {
        modal.confirm({
            title: `Удалить из базы заказы: ${selectedOrders.length}`,
            content: 'Строки исчезнут без возможности восстановления. Расчёты, из которых выросли '
                + 'эти заказы, останутся в дереве.',
            okText: 'Удалить навсегда',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                if (!(await ensureAdmin())) return;
                try {
                    const deleted = await calculatorApi.purgeOrders(selectedOrders);
                    onNotify(`Удалено из базы заказов: ${deleted}`, 'success');
                    load();
                } catch (err) {
                    if (isUnauthorized(err)) {
                        clearAdminAuth();
                        onNotify('Неверный пароль администратора', 'error');
                        return;
                    }
                    onNotify('Ошибка удаления: ' + (err as Error).message, 'error');
                }
            },
        });
    };

    return (
        <Card
            style={{ marginTop: 24, borderRadius: 16, border: '1px solid #e8eaed', boxShadow: 'none' }}
            styles={{ body: { padding: '16px 24px' } }}
        >
            <Flex justify="space-between" align="flex-start" gap={12}>
                <Flex vertical gap={2}>
                    <Typography.Text strong>Удаление данных</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Здесь только помеченные записи: в дереве удаление — это пометка, база чистится тут.
                    </Typography.Text>
                </Flex>
                <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                    Обновить
                </Button>
            </Flex>

            <Spin spinning={loading}>
                <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>
                    Помеченные расчёты
                </Typography.Text>
                <Table<SavedCalculation>
                    size="small"
                    rowKey="id"
                    style={{ marginTop: 8 }}
                    dataSource={calculations}
                    pagination={false}
                    locale={{ emptyText: 'Помеченных расчётов нет' }}
                    rowSelection={{
                        selectedRowKeys: selectedCalculations,
                        onChange: (keys) => setSelectedCalculations(keys as string[]),
                    }}
                    columns={[
                        { title: 'Расчёт', dataIndex: 'name', ellipsis: true },
                        { title: 'Клиент', dataIndex: 'clientName', width: 180, ellipsis: true },
                        {
                            title: 'Версия',
                            key: 'version',
                            width: 90,
                            render: (_, record) => <Tag>v{record.version ?? 1}</Tag>,
                        },
                        {
                            title: 'Обновлён',
                            key: 'updatedAt',
                            width: 150,
                            render: (_, record) => formatDate(record.updatedAt),
                        },
                    ]}
                />
                <Flex justify="flex-end" style={{ marginTop: 8 }}>
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        disabled={selectedCalculations.length === 0}
                        onClick={purgeCalculations}
                    >
                        Удалить из базы ({selectedCalculations.length})
                    </Button>
                </Flex>

                <Typography.Text strong style={{ display: 'block', marginTop: 24 }}>
                    Помеченные заказы
                </Typography.Text>
                <Table<CalculationOrder>
                    size="small"
                    rowKey="id"
                    style={{ marginTop: 8 }}
                    dataSource={orders}
                    pagination={false}
                    locale={{ emptyText: 'Помеченных заказов нет' }}
                    rowSelection={{
                        selectedRowKeys: selectedOrders,
                        onChange: (keys) => setSelectedOrders(keys as string[]),
                    }}
                    columns={[
                        { title: 'Заказ', dataIndex: 'number', width: 140 },
                        { title: 'Клиент', dataIndex: 'customerName', ellipsis: true },
                        {
                            title: 'Дата',
                            key: 'orderDate',
                            width: 120,
                            render: (_, record) => formatDate(record.orderDate),
                        },
                        {
                            title: 'Из версии',
                            key: 'source',
                            width: 110,
                            render: (_, record) => (record.sourceVersion ? `v${record.sourceVersion}` : '—'),
                        },
                    ]}
                />
                <Flex justify="flex-end" style={{ marginTop: 8 }}>
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        disabled={selectedOrders.length === 0}
                        onClick={purgeOrders}
                    >
                        Удалить из базы ({selectedOrders.length})
                    </Button>
                </Flex>
            </Spin>
        </Card>
    );
};

