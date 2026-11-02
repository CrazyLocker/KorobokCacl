// frontend/src/components/Calculations/CalculationsPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntdApp } from 'antd';
import {
    Button, Card, Flex, Spin, Table, Tag, Tooltip, Typography,
} from 'antd';
import type { CalculationTree, CalculationVersion, CustomerTree, OrderTree } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { openCalculationEditor } from '../../navigation';
import { buildCalculationTreeRows, type CalculationTreeRow } from '../../utils/calculationTree';
import { CalculationViewDrawer } from '../Settings/CalculationViewDrawer';
import { CreateOrderModal } from './CreateOrderModal';
import { OrderDrawer } from './OrderDrawer';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

const MONEY = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

// Тираж печатается без копеек и с разрядами: «1 000».
const QUANTITY = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const money = (value?: number | null): string =>
    value == null ? '—' : `${MONEY.format(value)} ₽`;

const formatDate = (value?: string | null): string => {
    if (!value) return '—';

    // Дата заказа приходит как yyyy-mm-dd — без времени. `new Date` читает её
    // как UTC-полночь и при выводе сдвигает на часовой пояс (04:00 в Самаре),
    // поэтому такие значения печатаем как дату, без часов и минут.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${day}.${month}.${year.slice(2)}`;
    }

    return new Date(value).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Страница «Сохранённые расчёты»: дерево клиентов, заказов и расчётов.
 *
 * <p>Раскрытие расчёта подгружает его версии; клик по версии открывает её в
 * «Виде расчёта», откуда можно создать подветку от выбранной версии.
 */
export const CalculationsPage = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [customers, setCustomers] = useState<CustomerTree[]>([]);
    const [versionsByCalculation, setVersionsByCalculation] = useState<
        Record<string, CalculationVersion[]>
    >({});
    const [loading, setLoading] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    // Открытый «Вид расчёта»: id выбранной версии, null — дровер закрыт.
    const [viewId, setViewId] = useState<string | null>(null);
    // Версия, из которой создаётся заказ; null — модалка закрыта.
    const [orderSource, setOrderSource] = useState<CalculationVersion | null>(null);
    // Открытая карточка заказа: просмотр или правка.
    const [orderTarget, setOrderTarget] = useState<{ order: OrderTree; edit: boolean } | null>(null);

    // Версии грузим сразу для всех расчётов, чтобы раскрытие расчёта было
    // мгновенным: кэш наполняем молча, дерево остаётся свёрнутым.
    const loadVersions = useCallback((tree: CustomerTree[]) => {
        const calculations = tree.flatMap((customer) => customer.calculations);

        if (calculations.length === 0) {
            setVersionsByCalculation({});
            return;
        }

        Promise.all(calculations.map((calculation) => calculatorApi
            .getCalculationVersions(calculation.id)
            .then((versions) => [calculation.id, versions] as const)
            .catch(() => [calculation.id, [] as CalculationVersion[]] as const)))
            .then((entries) => setVersionsByCalculation(Object.fromEntries(entries)));
    }, []);

    const loadTree = useCallback(() => {
        setLoading(true);
        calculatorApi.getCalculationTree()
            .then((tree) => {
                setCustomers(tree);
                loadVersions(tree);
            })
            .catch((err: Error) => onNotify('Ошибка загрузки расчётов: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    }, [loadVersions, onNotify]);

    useEffect(() => {
        loadTree();
    }, [loadTree]);

    const rows = useMemo(
        () => buildCalculationTreeRows(customers, versionsByCalculation),
        [customers, versionsByCalculation],
    );

    /** Раскрытие расчёта подгружает его версии (один раз на расчёт). */
    const handleExpand = (expanded: boolean, record: CalculationTreeRow) => {
        setExpandedKeys((previous) => expanded
            ? [...previous, record.key]
            : previous.filter((key) => key !== record.key));

        if (!expanded || record.kind !== 'calculation' || !record.calculation) return;
        if (versionsByCalculation[record.calculation.id]) return;

        calculatorApi.getCalculationVersions(record.calculation.id)
            .then((versions) => setVersionsByCalculation((previous) => ({
                ...previous,
                [record.calculation!.id]: versions,
            })))
            .catch((err: Error) => onNotify('Ошибка загрузки версий: ' + err.message, 'error'));
    };

    // Удаление расчёта: подтверждение через modal.confirm (App.useApp).
    // Версии не стираются — помечаются удалёнными, чтобы история осталась.
    const handleDeleteCalculation = (calculation: CalculationTree) => {
        modal.confirm({
            title: 'Удаление расчёта',
            content: 'Пометить расчёт удалённым? Версии останутся в истории зачёркнутыми.',
            okText: 'Удалить',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.deleteCalculation(calculation.id);
                    setVersionsByCalculation((previous) => {
                        const next = { ...previous };
                        delete next[calculation.id];
                        return next;
                    });
                    onNotify('Расчёт помечен удалённым', 'success');
                    loadTree();
                } catch (err) {
                    onNotify('Ошибка удаления: ' + (err as Error).message, 'error');
                }
            },
        });
    };

    // Полное удаление ветки: версия и все её подветки стираются из базы.
    // Это необратимо, поэтому подтверждение отдельное и с явным текстом.
    const handlePurgeVersion = (version: CalculationVersion) => {
        modal.confirm({
            title: `Полное удаление ветки v${version.version}`,
            content: 'Версия и все её подветки будут удалены из базы без возможности '
                + 'восстановления. Ветку, из которой вырос заказ, удалить нельзя — '
                + 'сначала удалите заказ.',
            okText: 'Удалить навсегда',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.purgeCalculation(version.id);
                    onNotify(`Ветка v${version.version} удалена полностью`, 'success');
                    loadTree();
                } catch (err) {
                    onNotify('Ошибка удаления: ' + (err as Error).message, 'error');
                }
            },
        });
    };

    // Первая колонка ограничена 45 символами: длинные названия расчётов
    // обрезаются с многоточием, полный текст виден в подсказке.
    const titleCell = (record: CalculationTreeRow) => (
        <Flex vertical gap={0} style={{ minWidth: 0 }}>
            <Flex gap={6} align="center" style={{ minWidth: 0 }}>
                <Tooltip title={record.title}>
                    <span
                        style={{
                            display: 'inline-block',
                            maxWidth: '45ch',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'bottom',
                            fontSize: 13,
                            fontWeight: record.kind === 'customer' ? 600 : 400,
                        }}
                    >
                        {record.title}
                    </span>
                </Tooltip>
                {record.kind === 'calculation' && record.calculation && (
                    <Tag style={{ fontSize: 11, height: 20, lineHeight: '18px', marginInlineEnd: 0 }}>
                        v{record.calculation.version}
                    </Tag>
                )}
                {record.kind === 'version' && record.version?.deleted && (
                    <Tag style={{ fontSize: 10, height: 18, lineHeight: '16px', marginInlineEnd: 0 }}>
                        удалена
                    </Tag>
                )}
            </Flex>
            {record.subtitle && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                    {record.subtitle}
                </Typography.Text>
            )}
        </Flex>
    );

    // Помеченная удалённой версия или расчёт зачёркивается целиком: строка в
    // истории остаётся, но видно, что она больше не участвует в работе.
    const rowStyle = (record: CalculationTreeRow) => (
        record.deleted
            ? { textDecoration: 'line-through', color: '#9aa0a6' }
            : undefined
    );

    const actions = (record: CalculationTreeRow) => {
        if (record.kind === 'order' && record.order) {
            return (
                <Flex justify="flex-end" gap={4}>
                    <Button
                        size="small"
                        type="text"
                        onClick={() => setOrderTarget({ order: record.order!, edit: false })}
                        style={{ fontSize: 11 }}
                    >
                        Открыть
                    </Button>
                    <Button
                        size="small"
                        type="text"
                        onClick={() => setOrderTarget({ order: record.order!, edit: true })}
                        style={{ fontSize: 11 }}
                    >
                        Редактировать
                    </Button>
                </Flex>
            );
        }
        if (record.kind === 'version' && record.version) {
            return (
                <Flex justify="flex-end" gap={4}>
                    <Button size="small" type="text" onClick={() => setViewId(record.version!.id)}
                        style={{ fontSize: 11 }}>
                        Открыть
                    </Button>
                    <Button
                        size="small"
                        type="text"
                        disabled={record.version.deleted}
                        onClick={() => setOrderSource(record.version!)}
                        style={{ fontSize: 11 }}
                    >
                        Заказ
                    </Button>
                    <Button
                        size="small"
                        type="text"
                        danger
                        onClick={() => handlePurgeVersion(record.version!)}
                        style={{ fontSize: 11 }}
                    >
                        Удалить навсегда
                    </Button>
                </Flex>
            );
        }
        if (record.kind !== 'calculation' || !record.calculation) return null;

        return (
            <Flex justify="flex-end" gap={4}>
                <Button size="small" type="text" onClick={() => setViewId(record.calculation!.id)}
                    style={{ fontSize: 11 }}>
                    Открыть
                </Button>
                <Button
                    size="small"
                    type="text"
                    onClick={() => openCalculationEditor(record.calculation!.latestId ?? record.calculation!.id)}
                    style={{ fontSize: 11 }}
                >
                    Редактировать
                </Button>
                <Button
                    size="small"
                    type="text"
                    danger
                    onClick={() => handleDeleteCalculation(record.calculation!)}
                    style={{ fontSize: 11 }}
                >
                    Удалить
                </Button>
            </Flex>
        );
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
                            Клиент → заказ → расчёт. Раскройте расчёт, чтобы увидеть дерево версий.
                        </Typography.Text>
                    </Flex>
                    <Button size="small" type="text" onClick={loadTree} style={{ fontSize: 12 }}>
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
                ) : rows.length === 0 ? (
                    <Typography.Text style={{ display: 'block', padding: 24, fontSize: 13, color: '#9aa0a6' }}>
                        Нет сохранённых расчётов. Сохраните расчёт на странице калькулятора.
                    </Typography.Text>
                ) : (
                    <Table<CalculationTreeRow>
                        rowKey="key"
                        size="small"
                        pagination={false}
                        tableLayout="fixed"
                        dataSource={rows}
                        onRow={(record) => ({ style: rowStyle(record) })}
                        expandable={{
                            // Дерево держим раскрытым вручную: версии вложены по
                            // parentId, поэтому раскрывать можно и версию с ветками.
                            expandedRowKeys: expandedKeys,
                            onExpand: handleExpand,
                            rowExpandable: (record) => (record.children?.length ?? 0) > 0,
                            indentSize: 18,
                        }}
                        columns={[
                            {
                                title: 'Клиент / заказ / расчёт',
                                dataIndex: 'title',
                                key: 'title',
                                render: (_: unknown, record: CalculationTreeRow) => titleCell(record),
                            },
                            {
                                title: 'Себестоимость',
                                dataIndex: 'cost',
                                key: 'cost',
                                width: 160,
                                align: 'center',
                                onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
                                render: (cost: number | null | undefined, record: CalculationTreeRow) => (
                                    <span style={{
                                        fontSize: 12,
                                        color: record.kind === 'version' ? '#5f6368' : '#202124',
                                    }}>
                                        {money(cost)}
                                    </span>
                                ),
                            },
                            {
                                title: 'Цена клиента',
                                dataIndex: 'clientPrice',
                                key: 'clientPrice',
                                width: 150,
                                align: 'center',
                                onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
                                render: (price: number | null | undefined, record: CalculationTreeRow) => (
                                    <Flex vertical gap={0} align="center">
                                        <span style={{
                                            fontSize: 12,
                                            fontWeight: record.kind === 'customer' ? 600 : 400,
                                            color: record.kind === 'customer' ? '#202124' : '#5f6368',
                                        }}>
                                            {money(price)}
                                        </span>
                                        {record.quantity != null && (
                                            <span style={{ fontSize: 10, color: '#8c8c8c' }}>
                                                за {QUANTITY.format(record.quantity)} шт
                                            </span>
                                        )}
                                    </Flex>
                                ),
                            },
                            {
                                title: 'Обновлён',
                                dataIndex: 'updatedAt',
                                key: 'updatedAt',
                                width: 140,
                                align: 'center',
                                onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
                                render: (value: string | null | undefined) => (
                                    <span style={{ fontSize: 11, color: '#5f6368' }}>{formatDate(value)}</span>
                                ),
                            },
                            {
                                title: '',
                                key: 'actions',
                                width: 260,
                                align: 'right',
                                render: (_: unknown, record: CalculationTreeRow) => actions(record),
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
                onCreateOrder={setOrderSource}
                onChanged={() => {
                    // Правка меняет дерево и закэшированные версии — сбрасываем кэш.
                    setVersionsByCalculation({});
                    loadTree();
                }}
            />

            <CreateOrderModal
                open={!!orderSource}
                version={orderSource}
                onClose={() => setOrderSource(null)}
                onNotify={onNotify}
                onCreated={() => {
                    // Заказ виден в дереве: перечитываем и клиентов, и версии.
                    setVersionsByCalculation({});
                    loadTree();
                }}
            />

            <OrderDrawer
                open={!!orderTarget}
                order={orderTarget?.order ?? null}
                startInEdit={orderTarget?.edit ?? false}
                onClose={() => setOrderTarget(null)}
                onNotify={onNotify}
                onSaved={() => {
                    setVersionsByCalculation({});
                    loadTree();
                }}
            />
        </div>
    );
};

