// frontend/src/components/Calculator/CalculatorPage.tsx
// Единственная страница «Расчёт коробки» на Ant Design.
import { DeleteOutlined } from '@ant-design/icons';
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Col,
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
    Tooltip,
    Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import type { CalculatorModel } from '../../hooks/useCalculator';
import type { Detail, Extra, PriceRow } from '../../types';
import { calcAssemblyRun } from '../../utils/assemblyCost';

const { Text, Title } = Typography;

interface CalculatorPageProps {
    calc: CalculatorModel;
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
 * Страница «Расчёт коробки». Состояние живёт в App, чтобы страница раскладки
 * могла передавать в калькулятор количества деталей.
 */
export const CalculatorPage = ({ calc }: CalculatorPageProps) => {

    const activeDetails = calc.details.filter((detail) => detail.enabled && detail.countOnSheet > 0);
    const currentPrintTable = calc.printTables.find((table) => table.formatId === calc.printSettings.format);
    const qtyOptions = currentPrintTable?.steps?.map((step) => step.minQty)
        || [100, 300, 500, 1000, 1500, 2000, 3000];

    // Список конструкций приходит только из справочника; порядок задаёт sortConstructs.
    const constructionOptions = calc.constructs.map((construct) => ({
        value: construct.name,
        label: construct.name,
    }));

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

    // --- «Сборка на печатный лист» ---
    // Один лист несёт комплект деталей; тираж коробок = тираж каждой детали.
    const assemblyEnabled = calc.assemblySettings.enabled;
    const assemblyTable = calc.printTables.find(
        (table) => table.formatId === calc.assemblySettings.format,
    );
    const assemblyDetails = activeDetails.filter((detail) => detail.inAssembly);
    // Детали с включённым флажком «Печать» — второй (взаимоисключающий) режим.
    const printedDetails = activeDetails.filter((detail) => detail.isPrinted);
    // Всего деталей на листе сборки: сумма «кол-во на лист» по отмеченным деталям.
    const assemblyPartsOnSheet = assemblyDetails.reduce(
        (sum, detail) => sum + Math.max(1, detail.partsPerSheetInAssembly ?? 1),
        0,
    );
    // Деталей в коробке = число активных деталей: 1 коробка = 1 комплект.
    const localAssembly = calcAssemblyRun(
        assemblyTable,
        calc.assemblySettings.boxQuantity,
        assemblyPartsOnSheet,
        activeDetails.length,
    );
    // Итог бэкенда приоритетнее; локальный расчёт закрывает паузу до ответа.
    const assembly = {
        partsOnSheet: assemblyPartsOnSheet,
        sheets: assemblyEnabled ? (calc.result?.assemblySheets ?? localAssembly.sheets) : 0,
        sheetCost: assemblyEnabled ? (calc.result?.assemblySheetCost ?? localAssembly.sheetCost) : 0,
        perPart: assemblyEnabled ? (calc.result?.assemblyCostPerPart ?? localAssembly.perPart) : 0,
    };

    // В режиме сборки стоимость печати детали — её доля стоимости листа сборки,
    // флажок «Печать» при этом не используется.
    const detailPrintCost = (detail: Detail): number =>
        assemblyEnabled
            ? (detail.inAssembly ? assembly.perPart : 0)
            : printCostPerUnit;
    const detailHasPrint = (detail: Detail): boolean =>
        assemblyEnabled ? Boolean(detail.inAssembly) : Boolean(detail.isPrinted);

    const totalBoxCost = activeDetails.reduce(
        (sum, detail) => sum
            + calculateDetailCost(
                detail,
                calc.extras,
                calc.workPrice,
                detailPrintCost(detail),
                detailHasPrint(detail),
            ),
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

    // Подсказка к заблокированным контролам печати: включён режим сборки.
    const withPrintHint = (node: ReactNode) => (assemblyEnabled ? (
        <Tooltip title="Включён режим «Сборка на печатный лист»: печать одной детали недоступна">
            <span style={{ display: 'inline-block', cursor: 'not-allowed' }}>{node}</span>
        </Tooltip>
    ) : node);

    const layoutColumns: TableColumnsType<Detail> = [
        {
            title: 'Вкл',
            dataIndex: 'enabled',
            width: 58,
            align: 'center',
            render: (_value, record) => (
                <Checkbox
                    checked={record.enabled}
                    onChange={(event) => calc.updateDetail(record.uiKey, 'enabled', event.target.checked)}
                    aria-label={`Включить деталь ${record.name}`}
                />
            ),
        },
        {
            title: 'Деталь',
            dataIndex: 'name',
            width: 210,
            render: (name: string, record) => (
                <Flex align="center" gap={6}>
                    {record.isCustom ? (
                        <Input
                            size="small"
                            value={record.name}
                            disabled={!record.enabled}
                            placeholder="Название"
                            onChange={(event) => calc.updateDetail(record.uiKey, 'name', event.target.value)}
                            style={{ width: 150 }}
                            data-testid={`detail-name-${record.uiKey}`}
                        />
                    ) : (
                        <Text strong={record.isCustom}>{name}</Text>
                    )}
                    {record.isCustom && <Tag color="gold" style={{ marginInlineEnd: 0 }}>своя</Tag>}
                </Flex>
            ),
        },
        {
            title: 'Шт/лист',
            dataIndex: 'countOnSheet',
            width: 110,
            align: 'right',
            render: (_value, record) => (
                <InputNumber
                    min={0}
                    precision={0}
                    step={1}
                    controls={false}
                    disabled={!record.enabled}
                    value={record.countOnSheet}
                    onChange={(value) => calc.updateDetail(record.uiKey, 'countOnSheet', Number(value) || 0)}
                    style={{ width: 80 }}
                    aria-label={`Шт на лист: ${record.name}`}
                />
            ),
        },
        {
            title: 'Руб/лист',
            dataIndex: 'sheetPrice',
            width: 120,
            align: 'right',
            render: (_value, record) => (
                <InputNumber
                    min={0}
                    precision={2}
                    step={0.01}
                    controls={false}
                    disabled={!record.enabled}
                    value={record.sheetPrice}
                    onChange={(value) => calc.updateDetail(record.uiKey, 'sheetPrice', Number(value) || 0)}
                    style={{ width: 90 }}
                    aria-label={`Рублей на лист: ${record.name}`}
                />
            ),
        },
        {
            title: 'Дет./лист (печать)',
            dataIndex: 'partsPerSheetOnPrint',
            width: 130,
            align: 'right',
            render: (_value, record) => withPrintHint(
                <InputNumber
                    min={1}
                    precision={0}
                    step={1}
                    controls={false}
                    disabled={!record.enabled || !record.isPrinted || assemblyEnabled}
                    value={record.partsPerSheetOnPrint ?? 1}
                    onChange={(value) => calc.updateDetail(
                        record.uiKey,
                        'partsPerSheetOnPrint',
                        Math.max(1, Number(value) || 1),
                    )}
                    style={{ width: 80 }}
                    aria-label={`Деталей на лист печати: ${record.name}`}
                />,
            ),
        },
        {
            title: 'Дополнительные операции',
            key: 'operations',
            render: (_value, record) => (
                <Space size={[12, 4]} wrap>
                    {withPrintHint(
                        <Checkbox
                            checked={Boolean(record.isPrinted)}
                            disabled={!record.enabled || assemblyEnabled}
                            onChange={(event) => calc.updateDetail(record.uiKey, 'isPrinted', event.target.checked)}
                        >
                            <span style={{ fontSize: 12 }}>Печать</span>
                        </Checkbox>,
                    )}
                    {calc.extras.map((extra) => (
                        <Tooltip key={extra.name} title={extra.name}>
                            <Checkbox
                                checked={Boolean(record.operations?.[extra.name])}
                                disabled={!record.enabled}
                                onChange={(event) => calc.updateDetailOperation(
                                    record.uiKey,
                                    extra.name,
                                    event.target.checked,
                                )}
                            >
                                <span style={{ fontSize: 12 }}>
                                    {OPERATION_LABELS[extra.name] || extra.name.charAt(0)}
                                </span>
                            </Checkbox>
                        </Tooltip>
                    ))}
                </Space>
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 56,
            align: 'center',
            render: (_value, record) => (
                record.isCustom ? (
                    <Tooltip title="Удалить деталь">
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={`Удалить деталь ${record.name}`}
                            onClick={() => calc.removeCustomDetail(record.uiKey)}
                        />
                    </Tooltip>
                ) : null
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
                    precision={2}
                    step={0.01}
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

    // Таблица «в сборку»: деталь, флажок участия, количество на листе и цена.
    const assemblyColumns: TableColumnsType<Detail> = [
        {
            title: 'Деталь',
            dataIndex: 'name',
            render: (_value, record) => (
                <Text strong={record.enabled}>{record.name}</Text>
            ),
        },
        {
            title: 'В сборку',
            dataIndex: 'inAssembly',
            width: 110,
            align: 'center',
            render: (_value, record) => (
                <Checkbox
                    checked={Boolean(record.inAssembly)}
                    disabled={!assemblyEnabled || !record.enabled || record.countOnSheet <= 0}
                    onChange={(event) => calc.toggleDetailInAssembly(record.uiKey, event.target.checked)}
                    aria-label={`В сборку: ${record.name}`}
                />
            ),
        },
        {
            title: 'Кол-во на лист',
            dataIndex: 'partsPerSheetInAssembly',
            width: 150,
            align: 'right',
            render: (_value, record) => (
                <InputNumber
                    min={1}
                    precision={0}
                    step={1}
                    controls={false}
                    disabled={!assemblyEnabled || !record.inAssembly}
                    value={record.partsPerSheetInAssembly ?? 1}
                    onChange={(value) => calc.updateDetail(
                        record.uiKey,
                        'partsPerSheetInAssembly',
                        Math.max(1, Number(value) || 1),
                    )}
                    style={{ width: 80 }}
                    aria-label={`Количество на листе сборки: ${record.name}`}
                />
            ),
        },
        {
            title: 'Цена детали',
            key: 'assemblyCost',
            width: 130,
            align: 'right',
            render: (_value, record) => (assemblyEnabled && record.inAssembly ? (
                <Tag
                    color="blue"
                    style={{ marginInlineEnd: 0, fontVariantNumeric: 'tabular-nums' }}
                >
                    {money(assembly.perPart)}
                </Tag>
            ) : (
                <Text type="secondary">—</Text>
            )),
        },
    ];

    // Включение сборки: тираж коробок по умолчанию равен тиражу печати.
    const handleAssemblyToggle = (checked: boolean) => {
        calc.updateAssemblySettings('enabled', checked);
        if (checked && calc.assemblySettings.boxQuantity < 1) {
            calc.updateAssemblySettings('boxQuantity', calc.printSettings.quantity);
        }
    };

    // «Печать» и «сборка» взаимоисключающие: снимаем флажки у всех деталей.
    const clearPrintedDetails = () => {
        activeDetails.forEach((detail) => {
            if (detail.isPrinted) {
                calc.updateDetail(detail.uiKey, 'isPrinted', false);
            }
        });
    };

    return (
        <div data-testid="calculator-page">
            <div
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                }}
            >
                <Flex justify="space-between" align="flex-start" gap={16} wrap style={{ marginBottom: 16 }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>Расчёт коробки</Title>
                        <Text type="secondary">Конструкция, раскладка, операции и цены в одном экране</Text>
                    </div>
                    <Space wrap>
                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>Ant Design 6</Tag>
                    </Space>
                </Flex>

                {calc.error && (
                    <Alert
                        type="error"
                        showIcon
                        title={calc.error}
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
                                options={constructionOptions}
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
                    {calc.details.length === 0 ? (
                        <Alert
                            type="warning"
                            showIcon
                            title="Добавьте хотя бы одну деталь"
                            description="В выбранной конструкции нет деталей. Перейдите в Справочники → Базовые коробки и добавьте детали."
                        />
                    ) : (
                        <Table<Detail>
                            columns={layoutColumns}
                            dataSource={calc.details}
                            rowKey="uiKey"
                            size="small"
                            pagination={false}
                            scroll={{ x: 980 }}
                            onRow={(record) => ({
                                style: {
                                    background: record.isCustom ? '#fafafa' : undefined,
                                    // A part with perSheet = 0 is still part of the
                                    // construction but is not used in the price,
                                    // so it stays visible and dimmed.
                                    opacity: record.enabled ? 1 : 0.5,
                                },
                            })}
                        />
                    )}
                </Card>

                {/* «Сборка на печатный лист»: один лист несёт комплект деталей. */}
                <Card
                    title={(
                        <Space>
                            Сборка на печатный лист
                            <Tag style={{ marginInlineEnd: 0 }}>{assemblyDetails.length}</Tag>
                        </Space>
                    )}
                    extra={<Text type="secondary">Деталей в коробке: {activeDetails.length}</Text>}
                    style={{ marginBottom: 16 }}
                >
                    <Form layout="inline" style={{ rowGap: 12, marginBottom: 12 }}>
                        <Form.Item style={{ marginBottom: 0 }}>
                            <Checkbox
                                checked={assemblyEnabled}
                                onChange={(event) => handleAssemblyToggle(event.target.checked)}
                                data-testid="assembly-enabled"
                            >
                                Включить сборку
                            </Checkbox>
                        </Form.Item>
                        <Form.Item label="Формат" style={{ marginBottom: 0 }}>
                            <Select
                                value={calc.assemblySettings.format}
                                disabled={!assemblyEnabled}
                                onChange={(format: number) => calc.updateAssemblySettings('format', format)}
                                options={calc.printTables.map((table) => ({
                                    value: table.formatId,
                                    label: table.formatName,
                                }))}
                                style={{ width: 200 }}
                            />
                        </Form.Item>
                        <Form.Item label="Тираж коробок" style={{ marginBottom: 0 }}>
                            <InputNumber
                                min={1}
                                precision={0}
                                step={1}
                                controls={false}
                                disabled={!assemblyEnabled}
                                // 0 = тираж ещё не задан: показываем тираж печати.
                                value={calc.assemblySettings.boxQuantity > 0
                                    ? calc.assemblySettings.boxQuantity
                                    : calc.printSettings.quantity}
                                onChange={(value) => calc.updateAssemblySettings(
                                    'boxQuantity',
                                    Math.max(1, Number(value) || 1),
                                )}
                                suffix="шт"
                                style={{ width: 120 }}
                                aria-label="Тираж коробок для сборки"
                            />
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                                → {money(assembly.perPart)} / деталь
                            </Tag>
                        </Form.Item>
                    </Form>

                    {assemblyEnabled && printedDetails.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            title="Печать одной детали и сборка взаимоисключающие"
                            description={
                                'Сборка уже включена, поэтому флажки «Печать» и «Дет./лист (печать)» '
                                + 'не участвуют в расчёте. Снимите их, чтобы не путаться в режимах.'
                            }
                            action={(
                                <Button size="small" onClick={clearPrintedDetails}>
                                    Снять «Печать»
                                </Button>
                            )}
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    {assemblyEnabled && assemblyDetails.length === 0 && (
                        <Alert
                            type="error"
                            showIcon
                            title="Отметьте хотя бы одну деталь «В сборку»"
                            description="Пока на листе сборки нет деталей, стоимость печати не считается."
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    <Table<Detail>
                        columns={assemblyColumns}
                        dataSource={calc.details}
                        rowKey="uiKey"
                        size="small"
                        pagination={false}
                        scroll={{ x: 640 }}
                        onRow={(record) => ({
                            style: {
                                opacity: record.enabled && record.countOnSheet > 0 ? 1 : 0.5,
                            },
                        })}
                    />

                    <Divider style={{ margin: '16px 0' }} />

                    <Flex gap={32} wrap>
                        <Statistic title="Деталей на листе" value={assembly.partsOnSheet} />
                        <Statistic title="Тираж листов" value={assembly.sheets} />
                        <Statistic
                            title="Стоимость листа"
                            value={assembly.sheetCost}
                            precision={2}
                            suffix="₽"
                        />
                        <Statistic
                            title="Стоимость детали"
                            value={assembly.perPart}
                            precision={2}
                            suffix="₽"
                        />
                    </Flex>
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
                                        detailPrintCost(detail),
                                        detailHasPrint(detail),
                                    );

                                    const formulaParts: string[] = [];
                                    if (materialCost > 0) {
                                        formulaParts.push(`${detail.sheetPrice}/${detail.countOnSheet}=${materialCost.toFixed(2)}`);
                                    }
                                    if (calc.workPrice > 0) {
                                        formulaParts.push(`работа ${calc.workPrice}`);
                                    }
                                    if (detailHasPrint(detail) && detailPrintCost(detail) > 0) {
                                        formulaParts.push(
                                            assemblyEnabled
                                                ? `сборка ${detailPrintCost(detail).toFixed(2)}`
                                                : `печать ${detailPrintCost(detail).toFixed(2)}`,
                                        );
                                    }
                                    if (extraCost > 0) {
                                        formulaParts.push(`+ ${extraCost.toFixed(2)} доп.`);
                                    }

                                    return (
                                        <div
                                            key={detail.uiKey}
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
                                        step={0.01}
                                        precision={2}
                                        controls={false}
                                        value={calc.workPrice}
                                        onChange={(value) => calc.setWorkPrice(Number(value) || 0)}
                                        suffix="₽"
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
                                    styles={{
                                        content: {
                                            color: '#1677ff',
                                            fontSize: 22,
                                            fontWeight: 600,
                                            fontVariantNumeric: 'tabular-nums',
                                        },
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
                                        <Tag
                                            color={assemblyEnabled ? 'default' : 'blue'}
                                            style={{ marginInlineEnd: 0 }}
                                        >
                                            {assemblyEnabled
                                                ? 'печать выключена: включена сборка'
                                                : `→ ${money(localPrintPerUnit)} / ед.`}
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
                                                    step={0.01}
                                                    precision={2}
                                                    controls={false}
                                                    value={extra.cost}
                                                    onChange={(value) => calc.updateExtra(
                                                        index,
                                                        'cost',
                                                        Number(value) || 0,
                                                    )}
                                                    suffix="₽"
                                                    style={{ width: 120 }}
                                                />
                                            </Space>
                                            <Space size={6}>
                                                <Tag
                                                    color="blue"
                                                    style={{
                                                        marginInlineEnd: 0,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {money(extra.cost)}
                                                </Tag>
                                                {extra.isCustom && (
                                                    <Tooltip title="Удалить операцию">
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            aria-label={`Удалить операцию ${extra.name}`}
                                                            onClick={() => calc.removeCustomExtra(index)}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </Space>
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
        </div>
    );
};

