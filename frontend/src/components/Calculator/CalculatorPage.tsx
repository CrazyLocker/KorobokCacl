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
import type { CSSProperties, ReactNode } from 'react';
import type { CalculatorModel } from '../../hooks/useCalculator';
import type { Detail, Extra, PriceRow } from '../../types';
import { calcAssemblyRun } from '../../utils/assemblyCost';
import type { AssemblyRun } from '../../utils/assemblyCost';
import { calcPrintPerUnit } from '../../utils/printCost';

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
 * Карточки «Сборка на печатный лист» и «Дополнительные операции» стоят рядом,
 * поэтому отступы тела карточек и кегль контролов у них одинаковые.
 */
const CARD_BODY_STYLE: CSSProperties = { padding: 16 };
const CONTROL_STYLE: CSSProperties = { fontSize: 16 };

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

    // --- «Сборка на печатный лист» ---
    // Один лист несёт комплект деталей, поэтому прогон считается сразу по всем
    // отмеченным деталям: листов нужно max(ceil(тираж / копий на лист)), а счёт
    // за лист делят все копии на листе — цена печати у деталей одна.
    const assemblyEnabled = calc.assemblySettings.enabled;
    const assemblyTable = calc.printTables.find(
        (table) => table.formatId === calc.assemblySettings.format,
    );
    const assemblyDetails = activeDetails.filter((detail) => detail.inAssembly);
    // Отмеченных деталей нет — печатать нечего (валидация бэкенда не пропустит
    // такой запрос, поэтому в UI показываем подсказку).
    const assemblyHasNoParts = assemblyDetails.length === 0;
    // Детали с включённым флажком «Печать»: режимы взаимоисключающие, поэтому
    // при включённой сборке в её шапке показываем компактный Tag (не Alert).
    const printedDetails = activeDetails.filter((detail) => detail.isPrinted);
    // Общий прогон комплекта: тираж листов, счёт, цена листа и цена копии.
    // Формула та же, что на бэкенде (PrintCostCalculator.calcAssemblyRun).
    const assemblyRun: AssemblyRun = calcAssemblyRun(
        // Выключенный режим не должен показывать цифры: прогон считается только
        // при включённой сборке.
        assemblyEnabled ? assemblyTable : undefined,
        calc.assemblySettings.quantity,
        assemblyDetails,
    );
    // Печать одной детали сборки: значение из ответа API по индексу детали,
    // иначе — локальный расчёт той же формулы. Ответ API точнее: он учитывает
    // таблицу печати, загруженную на бэкенде. Значение принимается только при
    // совпадении флажка и «кол-ва на лист»: иначе ответ относится к другому
    // состоянию строки (детали добавили/удалили после расчёта).
    const detailAssemblyPrintCost = (detail: Detail): number => {
        const detailId = calc.details.indexOf(detail);
        const colsOnSheet = detail.colsOnSheet ?? 1;
        const fromApi = detailId >= 0
            ? calc.result?.details?.find((item) => item.detailId === detailId
                && item.inAssembly === Boolean(detail.inAssembly)
                && item.colsOnSheet === colsOnSheet)
            : undefined;
        if (fromApi) {
            return fromApi.printBlocked ? 0 : fromApi.perPart;
        }
        return detail.inAssembly ? assemblyRun.perPart : 0;
    };
    // Стоимость печати одной детали (без НДС). У каждой детали своё «кол-во на
    // лист», поэтому единой цифры на весь заказ нет — считаем по детали:
    //   sheets = ceil(тираж / деталей на листе); (счёт / тираж) / деталей на листе
    // В режиме сборки печать детали — её доля стоимости листа сборки, флажок
    // «Печать» при этом не используется.
    const detailPrintCost = (detail: Detail): number => {
        if (assemblyEnabled) {
            return detail.inAssembly ? detailAssemblyPrintCost(detail) : 0;
        }
        return calcPrintPerUnit(
            currentPrintTable,
            calc.printSettings.quantity,
            detail.partsPerSheetOnPrint ?? 1,
        );
    };
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
            dataIndex: 'colsOnSheet',
            width: 150,
            align: 'right',
            render: (_value, record) => (
                <InputNumber
                    min={1}
                    precision={0}
                    step={1}
                    controls={false}
                    disabled={!assemblyEnabled || !record.inAssembly}
                    value={record.colsOnSheet ?? 1}
                    onChange={(value) => calc.updateDetail(
                        record.uiKey,
                        'colsOnSheet',
                        Math.max(1, Number(value) || 1),
                    )}
                    style={{ width: 80 }}
                    aria-label={`Количество на листе сборки: ${record.name}`}
                />
            ),
        },
        {
            title: 'Листов',
            key: 'assemblySheets',
            width: 90,
            align: 'right',
            render: (_value, record) => {
                if (!assemblyEnabled || !record.inAssembly) {
                    return <Text type="secondary">—</Text>;
                }
                return assemblyRun.sheets > 0
                    ? (
                        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {assemblyRun.sheets}
                        </Text>
                    )
                    : <Text type="secondary">—</Text>;
            },
        },
        {
            title: 'Печать детали',
            key: 'assemblyCost',
            width: 140,
            align: 'right',
            render: (_value, record) => {
                if (!assemblyEnabled || !record.inAssembly) {
                    return <Text type="secondary">—</Text>;
                }
                const perPart = detailAssemblyPrintCost(record);
                return perPart > 0 ? (
                    <Tag
                        color="blue"
                        style={{ marginInlineEnd: 0, fontVariantNumeric: 'tabular-nums' }}
                    >
                        {money(perPart)}
                    </Tag>
                ) : (
                    <Text type="secondary">—</Text>
                );
            },
        },
    ];

    // «Печать» и «сборка» взаимоисключающие: снимаем флажки у всех деталей.
    const clearPrintedDetails = () => {
        activeDetails.forEach((detail) => {
            if (detail.isPrinted) {
                calc.updateDetail(detail.uiKey, 'isPrinted', false);
            }
        });
    };

    // Включение сборки: все активные детали сразу идут в сборку по 1 шт. на
    // лист (если количество ещё не задано), тираж детали берётся из печати,
    // а флажки «Печать» снимаются — режимы взаимоисключающие.
    const handleAssemblyToggle = (checked: boolean) => {
        calc.updateAssemblySettings('enabled', checked);
        if (!checked) {
            return;
        }
        if (calc.assemblySettings.quantity < 1) {
            calc.updateAssemblySettings('quantity', calc.printSettings.quantity);
        }
        activeDetails.forEach((detail) => {
            if (!detail.inAssembly) {
                calc.updateDetail(detail.uiKey, 'inAssembly', true);
            }
            if ((detail.colsOnSheet ?? 0) < 1) {
                calc.updateDetail(detail.uiKey, 'colsOnSheet', 1);
            }
        });
        clearPrintedDetails();
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
                        <Form.Item label="Конструкция" style={{ marginBottom: 0 }}>
                            <Select
                                size="middle"
                                showSearch
                                optionFilterProp="label"
                                value={calc.currentConstruction || undefined}
                                placeholder="Выберите конструкцию"
                                loading={calc.constructs.length === 0}
                                onChange={(value: string) => calc.loadConstruction(value)}
                                options={constructionOptions}
                                style={{ ...CONTROL_STYLE, width: '20ch' }}
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

                {/* «Сборка на печатный лист» и «Доп. операции» — рядом под раскладкой. */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} lg={12}>
                        <Card
                            title={(
                                <Space>
                                    Сборка на печатный лист
                                    <Tag style={{ marginInlineEnd: 0 }}>{assemblyDetails.length}</Tag>
                                    {assemblyEnabled && printedDetails.length > 0 && (
                                        <Tag color="warning" style={{ marginInlineEnd: 0 }}>
                                            Печать снята (включена сборка)
                                        </Tag>
                                    )}
                                </Space>
                            )}
                            styles={{ body: CARD_BODY_STYLE }}
                            style={{ height: '100%' }}
                        >
                            <Form layout="inline" style={{ rowGap: 12, marginBottom: 12 }}>
                                <Form.Item style={{ marginBottom: 0 }}>
                                    <Checkbox
                                        checked={assemblyEnabled}
                                        onChange={(event) => handleAssemblyToggle(event.target.checked)}
                                        data-testid="assembly-enabled"
                                    >
                                        <span style={{ fontSize: 16 }}>Включить сборку</span>
                                    </Checkbox>
                                </Form.Item>
                                <Form.Item label="Формат" style={{ marginBottom: 0 }}>
                                    <Select
                                        size="middle"
                                        value={calc.assemblySettings.format}
                                        disabled={!assemblyEnabled}
                                        onChange={(format: number) => calc.updateAssemblySettings('format', format)}
                                        options={calc.printTables.map((table) => ({
                                            value: table.formatId,
                                            label: table.formatName,
                                        }))}
                                        style={{ ...CONTROL_STYLE, width: 160 }}
                                    />
                                </Form.Item>
                                <Form.Item label="Тираж детали" style={{ marginBottom: 0 }}>
                                    <InputNumber
                                        size="middle"
                                        min={1}
                                        precision={0}
                                        step={1}
                                        controls={false}
                                        disabled={!assemblyEnabled}
                                        // 0 = тираж ещё не задан: показываем тираж печати.
                                        value={calc.assemblySettings.quantity > 0
                                            ? calc.assemblySettings.quantity
                                            : calc.printSettings.quantity}
                                        onChange={(value) => calc.updateAssemblySettings(
                                            'quantity',
                                            Math.max(1, Number(value) || 1),
                                        )}
                                        suffix="шт"
                                        style={{ ...CONTROL_STYLE, width: 120 }}
                                        aria-label="Тираж детали для сборки"
                                    />
                                </Form.Item>
                            </Form>

                            {/* Единственный Alert блока: цена листа не считается без деталей. */}
                            {assemblyEnabled && assemblyHasNoParts && (
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
                                scroll={{ x: 620 }}
                                onRow={(record) => ({
                                    style: {
                                        opacity: record.enabled && record.countOnSheet > 0 ? 1 : 0.5,
                                    },
                                })}
                            />

                            <Divider style={{ margin: '16px 0' }} />

                            <Flex gap={24} wrap>
                                <Statistic
                                    title="Деталей на листе"
                                    value={assemblyRun.totalPartsOnSheet}
                                />
                                <Statistic title="Тираж листов" value={assemblyRun.sheets} />
                                <Statistic
                                    title="Стоимость тиража"
                                    value={assemblyRun.bill}
                                    precision={2}
                                    suffix="₽"
                                />
                            </Flex>
                        </Card>
                    </Col>

                    {/* Правый блок той же строки: «Дополнительные операции». */}
                    <Col xs={24} lg={12}>
                        <Card
                            title="Дополнительные операции"
                            extra={<Tag style={{ marginInlineEnd: 0 }}>{calc.extras.length}</Tag>}
                            styles={{ body: CARD_BODY_STYLE }}
                            style={{ height: '100%' }}
                        >
                            <Form layout="inline" style={{ marginBottom: 16, rowGap: 12 }}>
                                <Form.Item label="Печать" style={{ marginBottom: 0 }}>
                                    <Select
                                        size="middle"
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
                                        style={{ ...CONTROL_STYLE, width: 160 }}
                                    />
                                </Form.Item>
                                <Form.Item label="Тираж" style={{ marginBottom: 0 }}>
                                    <Select
                                        size="middle"
                                        value={calc.printSettings.quantity}
                                        onChange={(quantity: number) => {
                                            calc.updatePrintSettings('quantity', quantity);
                                            calc.updatePrintSettings('enabled', true);
                                        }}
                                        options={qtyOptions.map((quantity) => ({
                                            value: quantity,
                                            label: quantity,
                                        }))}
                                        style={{ ...CONTROL_STYLE, width: 100 }}
                                    />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 0 }}>
                                    <Tag
                                        color={assemblyEnabled ? 'default' : 'blue'}
                                        style={{ marginInlineEnd: 0, fontSize: 16 }}
                                    >
                                        {assemblyEnabled
                                            ? 'печать выключена: включена сборка'
                                            : calc.result?.printCostPerUnit != null
                                                ? `→ ${money(calc.result.printCostPerUnit)} / ед.`
                                                : '→ — / ед.'}
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
                                                    size="middle"
                                                    value={extra.name}
                                                    placeholder="Название"
                                                    onChange={(event) => calc.updateExtra(
                                                        index,
                                                        'name',
                                                        event.target.value,
                                                    )}
                                                    style={{ ...CONTROL_STYLE, width: 140 }}
                                                />
                                            ) : (
                                                <Text strong>{extra.name}</Text>
                                            )}
                                            <InputNumber
                                                size="middle"
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
                                                style={{ ...CONTROL_STYLE, width: 120 }}
                                            />
                                        </Space>
                                        <Space size={6}>
                                            <Tag
                                                color="blue"
                                                style={{
                                                    marginInlineEnd: 0,
                                                    fontSize: 16,
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
                    </Col>
                </Row>

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
                        </Flex>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

