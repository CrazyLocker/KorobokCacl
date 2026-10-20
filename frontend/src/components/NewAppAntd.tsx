// frontend/src/components/NewAppAntd.tsx
// Пилотная версия страницы «Расчёт коробки» на Ant Design.
// Функционал повторяет NewApp, но UI собран из компонентов antd.
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Col,
    ConfigProvider,
    Divider,
    Flex,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Space,
    Statistic,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { Header } from './Layout/Header';
import { ViewToggle } from './Layout/ViewToggle';
import type { AppView } from './Layout/ViewToggle';
import { useCalculator } from '../hooks/useCalculator';
import type { Detail, Extra, PriceRow } from '../types';
import { tokens } from '../theme';

const { Text, Title } = Typography;

interface NewAppAntdProps {
    view: AppView;
    onViewChange: (event: React.MouseEvent<HTMLElement>, value: AppView | null) => void;
}

const OPERATION_LABELS: Record<string, string> = {
    'Печать': 'П',
    'Лак': 'Лак',
    'Тиснение': 'Тис',
    'Конгрев': 'Кон',
    'Ламинация': 'Лам',
};

const TIER_LABELS = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

const money = (value: number): string => `${value.toFixed(2)} ₽`;

/**
 * Себестоимость детали: (Руб/Лист / Шт/Лист) + работа + печать + доп. операции.
 * Формула синхронизирована с CostBlock из Precision Instrument.
 */
const calculateDetailCost = (
    detail: Detail,
    extras: Extra[],
    workPrice: number,
    printCostPerUnit: number,
    hasPrintEnabled: boolean,
): number => {
    const materialCost = detail.countOnSheet > 0 ? detail.sheetPrice / detail.countOnSheet : 0;
    const extraCost = extras.reduce(
        (sum, extra) => sum + (detail.operations?.[extra.name] ? extra.cost : 0),
        0,
    );
    return materialCost + workPrice + (hasPrintEnabled ? printCostPerUnit : 0) + extraCost;
};

/**
 * Пилот Ant Design для страницы «Расчёт коробки».
 * Русская локаль подключается через ConfigProvider, тема — нативные токены antd.
 */
export const NewAppAntd = ({ view, onViewChange }: NewAppAntdProps) => {
    const calc = useCalculator();

    const activeDetails = calc.details.filter((detail) => detail.enabled && detail.countOnSheet > 0);
    const currentPrintTable = calc.printTables.find((table) => table.formatId === calc.printSettings.format);
    const qtyOptions = currentPrintTable?.steps?.map((step) => step.minQty)
        || [100, 300, 500, 1000, 1500, 2000, 3000];

    // Локальный расчёт стоимости печати на единицу — как в OperationsBlock.
    let localPrintPerUnit = 0;
    if (calc.printSettings.enabled && currentPrintTable && calc.printSettings.quantity > 0) {
        const step = currentPrintTable.steps.find((item) => item.minQty >= calc.printSettings.quantity);
        let cost = step?.price || currentPrintTable.steps[0]?.price || 0;
        if (calc.printSettings.quantity >= 3000) {
            const lastStep = currentPrintTable.steps[currentPrintTable.steps.length - 1];
            const extra = Math.ceil((calc.printSettings.quantity - 3000) / 1000) * currentPrintTable.stepAfter3000;
            cost = lastStep.price + extra;
        }
        localPrintPerUnit = cost / calc.printSettings.quantity;
    }

    const printCostPerUnit = calc.result?.printCostPerUnit ?? localPrintPerUnit;
    const totalBoxCost = activeDetails.reduce(
        (sum, detail) => sum
            + calculateDetailCost(detail, calc.extras, calc.workPrice, printCostPerUnit, Boolean(detail.isPrinted)),
        0,
    );

    const displayPrices: PriceRow[] = calc.result?.prices?.length
        ? calc.result.prices
        : TIER_LABELS.map((label) => ({
            label,
            withoutVAT: 0,
            calculatedPrice: 0,
            priceListPrice: 0,
            finalPrice: 0,
            isBase: label === '10–49',
            isPriceListUsed: false,
        }));

    const layoutColumns: TableColumnsType<Detail> = [
        {
            title: 'Деталь',
            dataIndex: 'name',
            render: (name: string, record) => (
                <Space size={6}>
                    <Text strong={record.isCustom}>{name}</Text>
                    {record.isCustom && <Tag color="gold" style={{ marginInlineEnd: 0 }}>своя</Tag>}
                </Space>
            ),
        },
        {
            title: 'Шт/лист',
            dataIndex: 'countOnSheet',
            width: 110,
            align: 'right',
            render: (_value, record, index) => (
                <InputNumber
                    min={0}
                    precision={0}
                    controls={false}
                    value={record.countOnSheet}
                    onChange={(value) => calc.updateDetail(index, 'countOnSheet', Number(value) || 0)}
                    style={{ width: 80 }}
                />
            ),
        },
        {
            title: 'Руб/лист',
            dataIndex: 'sheetPrice',
            width: 120,
            align: 'right',
            render: (_value, record, index) => (
                <InputNumber
                    min={0}
                    precision={2}
                    step={1}
                    controls={false}
                    value={record.sheetPrice}
                    onChange={(value) => calc.updateDetail(index, 'sheetPrice', Number(value) || 0)}
                    style={{ width: 90 }}
                />
            ),
        },
        {
            title: 'Дополнительные операции',
            key: 'operations',
            render: (_value, record, index) => (
                <Space size={[12, 4]} wrap>
                    {calc.extras.map((extra) => (
                        <Checkbox
                            key={extra.name}
                            checked={Boolean(record.operations?.[extra.name])}
                            onChange={(event) => calc.updateDetailOperation(index, extra.name, event.target.checked)}
                        >
                            <span style={{ fontSize: 12 }}>
                                {OPERATION_LABELS[extra.name] || extra.name.charAt(0)}
                            </span>
                        </Checkbox>
                    ))}
                </Space>
            ),
        },
    ];

    const priceColumns: TableColumnsType<PriceRow> = [
        {
            title: 'Тираж',
            dataIndex: 'label',
            render: (label: string, record) => (
                <Space size={6}>
                    <Text strong={record.isBase}>{label}</Text>
                    {record.isBase && <Tag color="gold" style={{ marginInlineEnd: 0 }}>базовая</Tag>}
                </Space>
            ),
        },
        {
            title: 'с НДС 11%',
            dataIndex: 'calculatedPrice',
            align: 'right',
            width: 120,
            render: (value: number) => (
                <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{value > 0 ? money(value) : '—'}</Text>
            ),
        },
        {
            title: 'Прайс (₽)',
            dataIndex: 'priceListPrice',
            align: 'right',
            width: 130,
            render: (value: number, record) => (
                <InputNumber
                    min={0}
                    precision={0}
                    controls={false}
                    value={value || undefined}
                    placeholder="—"
                    onChange={(next) => calc.updatePriceList(record.label, Number(next) || 0)}
                    style={{ width: 96 }}
                />
            ),
        },
        {
            title: 'Итог',
            dataIndex: 'finalPrice',
            align: 'right',
            width: 120,
            render: (value: number, record) => (
                <Text
                    strong
                    style={{
                        color: record.isPriceListUsed ? '#cf1322' : '#389e0d',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {value > 0 ? money(value) : '—'}
                </Text>
            ),
        },
    ];

    return (
        <ConfigProvider
            locale={ruRU}
            theme={{
                token: {
                    colorPrimary: '#1677ff',
                    borderRadius: 8,
                    fontFamily: tokens.typography.fontFamily,
                },
            }}
        >
            <Header actions={<ViewToggle view={view} onChange={onViewChange} />} />

            <div
                style={{
                    maxWidth: 1600,
                    margin: '0 auto',
                    padding: '16px 24px 32px',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
            >
                <Flex justify="space-between" align="flex-start" gap={16} wrap style={{ marginBottom: 16 }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>Расчёт коробки</Title>
                        <Text type="secondary">Пилотный интерфейс на Ant Design · русская локаль ru_RU</Text>
                    </div>
                    <Space wrap>
                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>Ant Design 6</Tag>
                        <Tag style={{ marginInlineEnd: 0 }}>Precision Instrument → antd</Tag>
                    </Space>
                </Flex>

                {calc.error && (
                    <Alert
                        type="error"
                        showIcon
                        message={calc.error}
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Card
                    size="small"
                    title="Базовая коробка"
                    extra={<Text type="secondary">Деталей в расчёте: {activeDetails.length}</Text>}
                    style={{ marginBottom: 16 }}
                >
                    <Form layout="inline" style={{ rowGap: 12 }}>
                        <Form.Item label="Конструкция" style={{ flex: '1 1 360px', marginBottom: 0 }}>
                            <Select
                                showSearch
                                optionFilterProp="label"
                                value={calc.currentConstruction || undefined}
                                placeholder="Выберите конструкцию"
                                loading={calc.constructs.length === 0}
                                onChange={(value: string) => calc.loadConstruction(value)}
                                options={calc.constructs.map((construct) => ({
                                    value: construct.name,
                                    label: construct.name,
                                }))}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                        <Form.Item label="Лист" style={{ marginBottom: 0 }}>
                            <Text strong>70 × 100</Text>
                        </Form.Item>
                    </Form>
                </Card>

                <Card
                    title={(
                        <Space>
                            Раскладка деталей на лист 70×100
                            <Tag style={{ marginInlineEnd: 0 }}>{calc.details.length}</Tag>
                        </Space>
                    )}
                    extra={(
                        <Button type="dashed" onClick={calc.addCustomDetail}>
                            + Добавить деталь
                        </Button>
                    )}
                    style={{ marginBottom: 16 }}
                >
                    <Table<Detail>
                        columns={layoutColumns}
                        dataSource={calc.details}
                        rowKey={(record, index) => `${record.name}-${index ?? 0}`}
                        size="small"
                        pagination={false}
                        scroll={{ x: 760 }}
                        locale={{ emptyText: calc.loading ? 'Загрузка…' : 'Нет деталей' }}
                        onRow={(record) => ({
                            style: record.isCustom ? { background: '#fafafa' } : undefined,
                        })}
                    />
                </Card>

                <Row gutter={[16, 16]}>
                    <Col xs={24} xl={11}>
                        <Card title="Себестоимость деталей / Коробки" style={{ height: '100%' }}>
                            <Flex vertical gap={12}>
                                {activeDetails.map((detail, index) => {
                                    const materialCost = detail.countOnSheet > 0
                                        ? detail.sheetPrice / detail.countOnSheet
                                        : 0;
                                    const extraCost = calc.extras.reduce(
                                        (sum, extra) => sum
                                            + (detail.operations?.[extra.name] ? extra.cost : 0),
                                        0,
                                    );
                                    const detailCost = calculateDetailCost(
                                        detail,
                                        calc.extras,
                                        calc.workPrice,
                                        printCostPerUnit,
                                        Boolean(detail.isPrinted),
                                    );

                                    const formulaParts: string[] = [];
                                    if (materialCost > 0) {
                                        formulaParts.push(`${detail.sheetPrice}/${detail.countOnSheet}=${materialCost.toFixed(2)}`);
                                    }
                                    if (calc.workPrice > 0) {
                                        formulaParts.push(`работа ${calc.workPrice}`);
                                    }
                                    if (detail.isPrinted && printCostPerUnit > 0) {
                                        formulaParts.push(`печать ${printCostPerUnit.toFixed(2)}`);
                                    }
                                    if (extraCost > 0) {
                                        formulaParts.push(`+ ${extraCost.toFixed(2)} доп.`);
                                    }

                                    return (
                                        <div
                                            key={`${detail.name}-${index}`}
                                            style={{
                                                paddingBottom: 10,
                                                borderBottom: index < activeDetails.length - 1
                                                    ? '1px solid #f0f0f0'
                                                    : 'none',
                                            }}
                                        >
                                            <Flex justify="space-between" align="center" gap={12}>
                                                <div style={{ minWidth: 0 }}>
                                                    <Text strong>{detail.name}</Text>
                                                    <div>
                                                        <Text
                                                            type="secondary"
                                                            style={{
                                                                fontSize: 12,
                                                                fontFamily: 'monospace',
                                                                fontVariantNumeric: 'tabular-nums',
                                                            }}
                                                        >
                                                            {formulaParts.length > 0
                                                                ? `(${formulaParts.join(' + ')})`
                                                                : '—'}
                                                        </Text>
                                                    </div>
                                                </div>
                                                <Text
                                                    strong
                                                    style={{
                                                        color: '#1677ff',
                                                        fontSize: 15,
                                                        whiteSpace: 'nowrap',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {money(detailCost)}
                                                </Text>
                                            </Flex>
                                        </div>
                                    );
                                })}
                                {activeDetails.length === 0 && (
                                    <Text type="secondary">Нет активных деталей с количеством на листе.</Text>
                                )}
                            </Flex>

                            <Divider style={{ margin: '16px 0' }} />

                            <Form layout="inline" style={{ marginBottom: 16 }}>
                                <Form.Item label="Работа/деталь" style={{ marginBottom: 0 }}>
                                    <InputNumber
                                        min={0}
                                        step={0.5}
                                        precision={2}
                                        value={calc.workPrice}
                                        onChange={(value) => calc.setWorkPrice(Number(value) || 0)}
                                        addonAfter="₽"
                                        style={{ width: 140 }}
                                    />
                                </Form.Item>
                                <Text type="secondary" style={{ alignSelf: 'center' }}>
                                    за каждую деталь
                                </Text>
                            </Form>

                            <Divider style={{ margin: '0 0 16px' }} />

                            <Flex justify="space-between" align="center" gap={16}>
                                <div>
                                    <Text strong>Коробка</Text>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Итого по активным деталям
                                        </Text>
                                    </div>
                                </div>
                                <Statistic
                                    value={totalBoxCost}
                                    precision={2}
                                    suffix="₽"
                                    valueStyle={{
                                        color: '#1677ff',
                                        fontSize: 22,
                                        fontWeight: 600,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                />
                            </Flex>
                        </Card>
                    </Col>

                    <Col xs={24} xl={13}>
                        <Flex vertical gap={16}>
                            <Card
                                title="Цена коробки"
                                extra={<Tag color="processing" style={{ marginInlineEnd: 0 }}>расчёт онлайн</Tag>}
                            >
                                <Table<PriceRow>
                                    columns={priceColumns}
                                    dataSource={displayPrices}
                                    rowKey={(record) => record.label}
                                    size="small"
                                    pagination={false}
                                    scroll={{ x: 560 }}
                                    onRow={(record) => ({
                                        style: record.isBase ? { background: '#fffbe6' } : undefined,
                                    })}
                                />

                                <Divider style={{ margin: '16px 0 12px' }} />

                                <Flex justify="space-between" align="center" gap={16}>
                                    <Text strong>Себестоимость коробки</Text>
                                    <Text
                                        strong
                                        style={{
                                            color: '#1677ff',
                                            fontSize: 16,
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {money(calc.result?.totalCost ?? totalBoxCost)}
                                    </Text>
                                </Flex>
                            </Card>

                            <Card
                                title="Дополнительные операции"
                                extra={<Tag style={{ marginInlineEnd: 0 }}>{calc.extras.length}</Tag>}
                            >
                                <Form layout="inline" style={{ marginBottom: 16, rowGap: 12 }}>
                                    <Form.Item label="Печать" style={{ marginBottom: 0 }}>
                                        <Select
                                            value={calc.printSettings.format}
                                            onChange={(format: number) => {
                                                const table = calc.printTables.find(
                                                    (item) => item.formatId === format,
                                                );
                                                const firstQty = table?.steps?.[0]?.minQty || 100;
                                                calc.updatePrintSettings('format', format);
                                                calc.updatePrintSettings('quantity', firstQty);
                                                calc.updatePrintSettings('enabled', true);
                                            }}
                                            options={calc.printTables.map((table) => ({
                                                value: table.formatId,
                                                label: table.formatName,
                                            }))}
                                            style={{ width: 200 }}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Тираж" style={{ marginBottom: 0 }}>
                                        <Select
                                            value={calc.printSettings.quantity}
                                            onChange={(quantity: number) => {
                                                calc.updatePrintSettings('quantity', quantity);
                                                calc.updatePrintSettings('enabled', true);
                                            }}
                                            options={qtyOptions.map((quantity) => ({
                                                value: quantity,
                                                label: quantity,
                                            }))}
                                            style={{ width: 100 }}
                                        />
                                    </Form.Item>
                                    <Form.Item style={{ marginBottom: 0 }}>
                                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                                            → {money(localPrintPerUnit)} / ед.
                                        </Tag>
                                    </Form.Item>
                                </Form>

                                <Divider style={{ margin: '0 0 8px' }} />

                                <Flex vertical>

                                    {calc.extras.map((extra, index) => (
                                        <Flex
                                            key={`${extra.name}-${index}`}
                                            justify="space-between"
                                            align="center"
                                            gap={12}
                                            wrap
                                            style={{
                                                padding: '6px 0',
                                                borderBottom: index < calc.extras.length - 1
                                                    ? '1px solid #f0f0f0'
                                                    : 'none',
                                            }}
                                        >
                                            <Space wrap>
                                                {extra.isCustom ? (
                                                    <Input
                                                        size="small"
                                                        value={extra.name}
                                                        placeholder="Название"
                                                        onChange={(event) => calc.updateExtra(
                                                            index,
                                                            'name',
                                                            event.target.value,
                                                        )}
                                                        style={{ width: 140 }}
                                                    />
                                                ) : (
                                                    <Text strong>{extra.name}</Text>
                                                )}
                                                <InputNumber
                                                    size="small"
                                                    min={0}
                                                    step={1}
                                                    precision={2}
                                                    value={extra.cost}
                                                    onChange={(value) => calc.updateExtra(
                                                        index,
                                                        'cost',
                                                        Number(value) || 0,
                                                    )}
                                                    addonAfter="₽"
                                                    style={{ width: 120 }}
                                                />
                                            </Space>
                                            <Tag
                                                color="blue"
                                                style={{
                                                    marginInlineEnd: 0,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {money(extra.cost)}
                                            </Tag>
                                        </Flex>
                                    ))}
                                </Flex>

                                <Button
                                    type="dashed"
                                    block
                                    onClick={calc.addCustomExtra}
                                    style={{ marginTop: 12 }}
                                >
                                    + Добавить операцию
                                </Button>
                            </Card>
                        </Flex>
                    </Col>
                </Row>
            </div>
        </ConfigProvider>
    );
};

