// frontend/src/components/Settings/CalculationViewDrawer.tsx
import { useEffect, useState } from 'react';
import {
    Alert, Descriptions, Drawer, Flex, Grid, Spin, Statistic, Table, Tag, Typography,
} from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';
import type {
    ApiDetail, CalculationRequest, CalculationView, Extra, PriceRow,
} from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { normalizeSavedCalculation } from '../../utils/normalizeSavedCalculation';

interface Props {
    /** Дровер открыт. */
    open: boolean;
    /** Идентификатор расчёта; null — показывать нечего. */
    id: string | null;
    /** Закрытие дровера. */
    onClose: () => void;
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

const MUTED = { color: '#9aa0a6' } as const;

const money = (value: number | null | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} ₽` : '—';

const formatDate = (value: string | null | undefined): string =>
    value ? new Date(value).toLocaleString('ru-RU') : '—';

/**
 * Текст строки «Печать». При включённой сборке обычная печать не работает:
 * режимы взаимоисключающие, и нормализатор гасит её при чтении старого state.
 */
const describePrintMode = (request: CalculationRequest): string =>
    request.printSettings.enabled
        ? `формат ${request.printSettings.format}, тираж ${request.printSettings.quantity}`
        : request.assemblySettings?.enabled
            ? 'выключена: работает режим сборки'
            : 'выключена';

/** Сообщение об ошибке загрузки: тело ErrorResponse важнее текста axios. */
const toErrorMessage = (err: unknown): string => {
    const response = (err as {
        response?: { data?: { message?: string; errors?: Record<string, string> } };
    })?.response;
    const detail = response?.data?.errors?.error;
    if (detail) return detail;
    if (response?.data?.message) return response.data.message;
    if (err instanceof Error) return err.message;
    return 'Неизвестная ошибка';
};

/**
 * Приводит запрос из ответа к безопасному виду: старые расчёты могут не
 * содержать printSettings/assemblySettings, а нормализатор даёт дефолты и
 * разрешает конфликт «печать + сборка» (сборка выигрывает).
 */
const normalizeViewRequest = (
    raw: CalculationRequest | null | undefined,
): { request: CalculationRequest | null; error: string | null } => {
    if (!raw) return { request: null, error: null };
    try {
        return { request: normalizeSavedCalculation(raw), error: null };
    } catch (err) {
        return { request: null, error: err instanceof Error ? err.message : String(err) };
    }
};

const DETAIL_COLUMNS: TableColumnsType<ApiDetail> = [
    {
        title: 'Деталь',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, row) => (
            <Flex gap={4} align="center" wrap>
                <span style={{ fontSize: 13 }}>{name || '—'}</span>
                {row.enabled === false && <Tag style={{ marginInlineEnd: 0 }}>выкл.</Tag>}
                {row.isCustom && <Tag color="blue" style={{ marginInlineEnd: 0 }}>своя</Tag>}
            </Flex>
        ),
    },
    {
        title: 'Шт/лист',
        dataIndex: 'countOnSheet',
        key: 'countOnSheet',
        align: 'right',
        width: 90,
    },
    {
        title: '₽/лист',
        dataIndex: 'sheetPrice',
        key: 'sheetPrice',
        align: 'right',
        width: 100,
        render: (value: number) => money(value),
    },
    {
        title: 'Печать',
        dataIndex: 'isPrinted',
        key: 'isPrinted',
        width: 90,
        render: (value: boolean) => (
            value
                ? <Tag color="processing" style={{ marginInlineEnd: 0 }}>да</Tag>
                : <span style={MUTED}>—</span>
        ),
    },
    {
        title: 'Сборка',
        dataIndex: 'colsOnSheet',
        key: 'colsOnSheet',
        width: 110,
        render: (colsOnSheet: number | undefined, row) => (
            row.inAssembly ? `${colsOnSheet ?? 1} на лист` : <span style={MUTED}>—</span>
        ),
    },
    {
        title: 'Операции',
        key: 'operations',
        render: (_value: unknown, row: ApiDetail) => {
            const enabled = Object.entries(row.operations ?? {})
                .filter(([, flag]) => flag)
                .map(([name]) => name);
            if (enabled.length === 0) return <span style={MUTED}>—</span>;
            return (
                <Flex gap={4} wrap>
                    {enabled.map((name) => (
                        <Tag key={name} style={{ marginInlineEnd: 0 }}>{name}</Tag>
                    ))}
                </Flex>
            );
        },
    },
];

const EXTRA_COLUMNS: TableColumnsType<Extra> = [
    {
        title: 'Операция',
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => name || '—',
    },
    {
        title: '₽ за деталь',
        dataIndex: 'cost',
        key: 'cost',
        align: 'right',
        width: 120,
        render: (value: number) => money(value),
    },
    {
        title: 'Включена',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 110,
        render: (value: boolean) => (
            value
                ? <Tag color="success" style={{ marginInlineEnd: 0 }}>да</Tag>
                : <Tag style={{ marginInlineEnd: 0 }}>нет</Tag>
        ),
    },
];

const PRICE_COLUMNS: TableColumnsType<PriceRow> = [
    { title: 'Тир', dataIndex: 'label', key: 'label', width: 110 },
    {
        title: 'Без НДС',
        dataIndex: 'withoutVAT',
        key: 'withoutVAT',
        align: 'right',
        render: (value: number) => money(value),
    },
    {
        title: 'Расчёт (с НДС)',
        dataIndex: 'calculatedPrice',
        key: 'calculatedPrice',
        align: 'right',
        render: (value: number) => (value > 0 ? money(value) : '—'),
    },
    {
        title: 'Прайс',
        dataIndex: 'priceListPrice',
        key: 'priceListPrice',
        align: 'right',
        render: (value: number) => (value > 0 ? money(value) : '—'),
    },
    {
        title: 'Итог',
        dataIndex: 'finalPrice',
        key: 'finalPrice',
        align: 'right',
        render: (value: number) => (value > 0 ? money(value) : '—'),
    },
    {
        title: 'Метки',
        key: 'flags',
        width: 170,
        render: (_value: unknown, row: PriceRow) => (
            <Flex gap={4} wrap>
                {row.isBase && <Tag color="gold" style={{ marginInlineEnd: 0 }}>базовая</Tag>}
                {row.isPriceListUsed && <Tag color="blue" style={{ marginInlineEnd: 0 }}>прайс-лист</Tag>}
                {!row.isBase && !row.isPriceListUsed && <span style={MUTED}>—</span>}
            </Flex>
        ),
    },
];

/**
 * Дровер «Вид расчёта»: метаданные сохранённого расчёта, сохранённый запрос
 * и результат пересчёта. Только чтение — ни одного поля ввода.
 */
export const CalculationViewDrawer = ({ open, id, onClose }: Props) => {
    const screens = Grid.useBreakpoint();
    const [view, setView] = useState<CalculationView | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !id) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setView(null);

        calculatorApi.getCalculationView(id)
            .then((data) => {
                if (!cancelled) setView(data);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(toErrorMessage(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, id]);

    const { request, error: normalizeError } = normalizeViewRequest(view?.request);
    const result = view?.result ?? null;

    const descriptionItems: DescriptionsProps['items'] = view ? [
        { key: 'name', label: 'Название', children: view.name || '—' },
        { key: 'client', label: 'Клиент', children: view.clientName || '—' },
        { key: 'manager', label: 'Менеджер', children: view.managerName || '—' },
        {
            key: 'status',
            label: 'Статус',
            children: (
                <Tag color={STATUS_COLORS[view.status] || 'default'} style={{ marginInlineEnd: 0 }}>
                    {STATUS_LABELS[view.status] || view.status}
                </Tag>
            ),
        },
        { key: 'createdAt', label: 'Создан', children: formatDate(view.createdAt) },
        { key: 'updatedAt', label: 'Обновлён', children: formatDate(view.updatedAt) },
        { key: 'construction', label: 'Конструкция', children: request?.construction || '—' },
        {
            key: 'workPrice',
            label: 'Работа за деталь',
            children: request ? money(request.workPrice) : '—',
        },
        {
            key: 'margin',
            label: 'Плечо',
            children: request?.marginValue !== undefined ? `+${request.marginValue}` : 'по умолчанию',
        },
    ] : [];

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={view?.name ? `Расчёт: ${view.name}` : 'Вид расчёта'}
            size={screens.md ? 900 : '100%'}
            destroyOnHidden
            styles={{ body: { padding: 16 } }}
        >
            {loading ? (
                <Flex justify="center" style={{ padding: 48 }}>
                    <Spin size="large" />
                </Flex>
            ) : error ? (
                <Alert
                    type="error"
                    showIcon
                    message="Не удалось загрузить расчёт"
                    description={error}
                />
            ) : view ? (
                <Flex vertical gap={16}>
                    {view.viewError && (
                        <Alert
                            type="error"
                            showIcon
                            message="Расчёт сохранён с ошибкой"
                            description={view.viewError}
                        />
                    )}
                    {!result && !view.viewError && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Нет результата"
                            description="Бэкенд не вернул пересчитанные числа."
                        />
                    )}
                    {normalizeError && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Запрос прочитан не полностью"
                            description={normalizeError}
                        />
                    )}

                    <Descriptions
                        size="small"
                        bordered
                        column={screens.md ? 2 : 1}
                        items={descriptionItems}
                    />

                    {request && (
                        <Flex vertical gap={8}>
                            <Typography.Text strong>Детали</Typography.Text>
                            <Table<ApiDetail>
                                size="small"
                                pagination={false}
                                dataSource={request.details}
                                rowKey={(_row, index) => String(index ?? 0)}
                                columns={DETAIL_COLUMNS}
                                scroll={{ x: 680 }}
                            />
                        </Flex>
                    )}

                    {request && request.extras.length > 0 && (
                        <Flex vertical gap={8}>
                            <Typography.Text strong>Дополнительные операции</Typography.Text>
                            <Table<Extra>
                                size="small"
                                pagination={false}
                                dataSource={request.extras}
                                rowKey={(_row, index) => String(index ?? 0)}
                                columns={EXTRA_COLUMNS}
                            />
                        </Flex>
                    )}

                    {request && (
                        <Descriptions
                            size="small"
                            bordered
                            column={1}
                            items={[
                                {
                                    key: 'print',
                                    label: 'Печать',
                                    children: describePrintMode(request),
                                },
                                {
                                    key: 'assembly',
                                    label: 'Сборка на печатный лист',
                                    children: request.assemblySettings?.enabled
                                        ? `формат ${request.assemblySettings.format}, `
                                            + `тираж ${request.assemblySettings.quantity}`
                                        : 'выключена',
                                },
                            ]}
                        />
                    )}

                    {result && (
                        <Flex vertical gap={8}>
                            <Typography.Text strong>Цены по тиражам</Typography.Text>
                            <Table<PriceRow>
                                size="small"
                                pagination={false}
                                dataSource={result.prices ?? []}
                                rowKey={(row) => row.label}
                                columns={PRICE_COLUMNS}
                                scroll={{ x: 640 }}
                                onRow={(row) => ({
                                    style: row.isBase ? { background: '#fffbe6' } : undefined,
                                })}
                            />
                        </Flex>
                    )}

                    {result && (
                        <Flex gap={24} wrap>
                            <Statistic
                                title="Себестоимость"
                                value={result.totalCost}
                                precision={2}
                                suffix="₽"
                            />
                            <Statistic
                                title="Базовая цена"
                                value={result.basePrice}
                                precision={2}
                                suffix="₽"
                            />
                            <Statistic
                                title="Базовая с НДС"
                                value={result.basePriceWithVAT}
                                precision={2}
                                suffix="₽"
                            />
                            <Statistic
                                title="Печать за единицу"
                                value={result.printCostPerUnit}
                                precision={2}
                                suffix="₽"
                            />
                            <Statistic title="Ветка" value={result.branch || '—'} />
                        </Flex>
                    )}
                </Flex>
            ) : null}
        </Drawer>
    );
};
