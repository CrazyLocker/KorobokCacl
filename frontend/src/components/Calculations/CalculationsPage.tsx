// frontend/src/components/Calculations/CalculationsPage.tsx
import { useEffect, useState } from 'react';
import { App as AntdApp } from 'antd';
import {
    Button, Card, Flex, Spin, Table, Tag, Tooltip, Typography,
} from 'antd';
import type { SavedCalculation } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { openCalculationEditor } from '../../navigation';
import { CalculationViewDrawer } from '../Settings/CalculationViewDrawer';
import { CalculationVersions } from '../Settings/CalculationVersions';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

const STATUS_LABELS: Record<string, string> = {
    draft: 'Черновик',
    ready: 'Готов',
    sent: 'Отправлен',
    in_work: 'В работе',
    closed: 'Закрыт',
};

const STATUS_COLORS: Record<string, string> = {
    draft: 'default',
    ready: 'processing',
    sent: 'warning',
    in_work: 'success',
    closed: 'red',
};

/**
 * Страница «Сохранённые расчёты»: все расчёты с историей версий.
 *
 * <p>Каждая строка — расчёт-корень, под ней раскрывается дерево версий:
 * клик по версии открывает её в «Виде расчёта», оттуда же «Редактировать эту
 * версию» создаёт подветку от выбранной.
 */
export const CalculationsPage = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
    const [loading, setLoading] = useState(false);
    // Открытый «Вид расчёта»: id выбранной версии, null — дровер закрыт.
    const [viewId, setViewId] = useState<string | null>(null);

    const loadCalculations = () => {
        setLoading(true);
        calculatorApi.listCalculations()
            .then(setCalculations)
            .catch((err: Error) => onNotify('Ошибка загрузки расчётов: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadCalculations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Удаление расчёта: подтверждение через modal.confirm (App.useApp).
    // Версии не стираются — помечаются удалёнными, чтобы история осталась.
    const handleDeleteCalculation = (id: string) => {
        modal.confirm({
            title: 'Удаление расчёта',
            content: 'Пометить расчёт удалённым? Версии останутся в истории зачёркнутыми.',
            okText: 'Удалить',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.deleteCalculation(id);
                    setCalculations((prev) => prev.filter((c) => c.id !== id));
                    onNotify('Расчёт помечен удалённым', 'success');
                } catch (err) {
                    onNotify('Ошибка удаления: ' + (err as Error).message, 'error');
                }
            },
        });
    };

    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <Card
                style={{
                    marginBottom: 16,
                    borderRadius: 16,
                    border: '1px solid #e8eaed',
                    backgroundColor: '#fff',
                    boxShadow: 'none',
                }}
                styles={{ body: { padding: '16px 24px' } }}
            >
                <Flex justify="space-between" align="center" gap={12}>
                    <Flex vertical gap={2}>
                        <Typography.Title level={5} style={{ fontSize: 18, margin: 0 }}>
                            Сохранённые расчёты
                        </Typography.Title>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Разверните расчёт, чтобы увидеть дерево версий
                        </Typography.Text>
                    </Flex>
                    <Button size="small" type="text" onClick={loadCalculations} style={{ fontSize: 12 }}>
                        Обновить
                    </Button>
                </Flex>
            </Card>

            <Card
                style={{
                    borderRadius: 12,
                    border: '1px solid #e8eaed',
                    overflow: 'hidden',
                    boxShadow: 'none',
                }}
                styles={{ body: { padding: 0 } }}
            >
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                        <Spin size="large" />
                    </div>
                ) : calculations.length === 0 ? (
                    <Typography.Text style={{ display: 'block', padding: 24, fontSize: 13, color: '#9aa0a6' }}>
                        Нет сохранённых расчётов. Сохраните расчёт на странице калькулятора.
                    </Typography.Text>
                ) : (
                    <Table
                        rowKey="id"
                        size="small"
                        pagination={false}
                        // fixed layout: «Название» держит ровно 30ch, остальное
                        // свободное место забирает колонка «Клиент» (без width).
                        tableLayout="fixed"
                        dataSource={calculations}
                        expandable={{
                            // Дерево версий под строкой: раскрывается по клику,
                            // у одно-версионных расчётов стрелки нет.
                            columnWidth: 48,
                            rowExpandable: (record: SavedCalculation) => (record.versionCount ?? 1) > 1,
                            expandedRowRender: (record: SavedCalculation) => (
                                <CalculationVersions rootId={record.id} onOpen={setViewId} />
                            ),
                        }}
                        columns={[
                            {
                                title: 'Название',
                                dataIndex: 'name',
                                key: 'name',
                                width: '30ch',
                                render: (name: string) => (
                                    <span
                                        style={{
                                            fontSize: 13,
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {name}
                                    </span>
                                ),
                            },
                            {
                                title: 'Клиент',
                                dataIndex: 'clientName',
                                key: 'clientName',
                                render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
                            },
                            {
                                title: 'Менеджер',
                                dataIndex: 'managerName',
                                key: 'managerName',
                                width: 160,
                                render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
                            },
                            {
                                // Последняя ветка дерева: полная история — в раскрытой строке.
                                title: 'Версия',
                                dataIndex: 'version',
                                key: 'version',
                                width: 110,
                                render: (version: number | undefined, c: SavedCalculation) => (
                                    <Flex gap={4} align="center">
                                        <Tag
                                            color={version && version > 1 ? 'blue' : 'default'}
                                            style={{ fontSize: 11, height: 22, lineHeight: '20px', marginInlineEnd: 0 }}
                                        >
                                            v{version ?? 1}
                                        </Tag>
                                        {c.versionCount && c.versionCount > 1 && (
                                            <Tooltip title={`Версий в дереве: ${c.versionCount}`}>
                                                <span style={{ fontSize: 11, color: '#5f6368' }}>
                                                    · {c.versionCount}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </Flex>
                                ),
                            },
                            {
                                title: 'Статус',
                                dataIndex: 'status',
                                key: 'status',
                                width: 110,
                                render: (_: unknown, c: SavedCalculation) => (
                                    <Tag
                                        color={STATUS_COLORS[c.status] || 'default'}
                                        style={{ fontSize: 11, height: 22, lineHeight: '20px' }}
                                    >
                                        {STATUS_LABELS[c.status] || c.status}
                                    </Tag>
                                ),
                            },
                            {
                                title: 'Создан',
                                dataIndex: 'createdAt',
                                key: 'createdAt',
                                width: 170,
                                render: (v: string) => (
                                    <span style={{ fontSize: 12, color: '#5f6368' }}>
                                        {new Date(v).toLocaleString('ru-RU')}
                                    </span>
                                ),
                            },
                            {
                                title: '',
                                key: 'actions',
                                width: 250,
                                align: 'right',
                                render: (_: unknown, c: SavedCalculation) => (
                                    <Flex justify="flex-end" gap={4}>
                                        <Button
                                            size="small"
                                            type="text"
                                            onClick={() => setViewId(c.id)}
                                            style={{ fontSize: 11 }}
                                        >
                                            Открыть
                                        </Button>
                                        <Button
                                            size="small"
                                            type="text"
                                            onClick={() => openCalculationEditor(c.latestId ?? c.id)}
                                            style={{ fontSize: 11 }}
                                        >
                                            Редактировать
                                        </Button>
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            onClick={() => handleDeleteCalculation(c.id)}
                                            style={{ fontSize: 11 }}
                                        >
                                            Удалить
                                        </Button>
                                    </Flex>
                                ),
                            },
                        ]}
                    />
                )}
            </Card>

            <CalculationViewDrawer
                open={!!viewId}
                id={viewId}
                onClose={() => setViewId(null)}
                onEdit={openCalculationEditor}
                onChanged={loadCalculations}
            />
        </div>
    );
};
