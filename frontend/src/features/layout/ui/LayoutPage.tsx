/**
 * Layout page: sheet parameters and one part or the part list on the left,
 * packing preview on the right.
 *
 * The mode switch follows the prototype: single mode edits one part, multi mode
 * edits the part list. Sheet presets and the parts table only change state; the
 * result pane renders LayoutSvgSingle for a GridOk (single mode) and LayoutSvg
 * for a PackOk (multi mode), an empty hint while the list has no parts, or a red
 * block with the localised engine error. A successful multi packing adds the
 * metrics block under the drawing: big placed count, work-zone bar and three
 * summary cards. Single mode prints the grid count above the drawing.
 *
 * The left panel ends with "Передать в расчёт": it sends the placed counts of
 * the current result to the calculator through an App-owned callback.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  BarChartOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { Button, Card, Checkbox, Flex, Input, Spin, Tabs, Typography } from 'antd';
import { paletteFor } from '../model/constants.ts';
import { packParts } from '../engine/packParts.ts';
import { useLayout } from '../hooks/useLayout.ts';
import type { LayoutMode, LayoutResult } from '../hooks/useLayout.ts';
import type {
  ByTypeItem,
  GridOk,
  NotPlacedItem,
  PackOk,
  PartInput,
  SheetSpec,
} from '../model/types.ts';
import { LayoutSvg } from './LayoutSvg.tsx';
import { LayoutSvgSingle } from './LayoutSvgSingle.tsx';

/** Part added by the button; the name is generated on every click. */
const DEFAULT_PART = { L: 100, W: 180, qty: 1 } as const;

/** Quantity used to ask the engine how many parts fit alone; prototype uses 999. */
const ALONE_QTY = 999;

/** Quick sheet formats of the prototype. Clicking one overwrites sheetL/sheetW. */
const SHEET_PRESETS = [
  { label: '350×333', sheetL: 350, sheetW: 333 },
  { label: '500×350', sheetL: 500, sheetW: 350 },
  { label: '700×500', sheetL: 700, sheetW: 500 },
  { label: '1000×700', sheetL: 1000, sheetW: 700 },
] as const;

/** Columns of one parts-table row: colour, name, L, W, qty, delete. */
const PART_ROW_COLUMNS = '10px minmax(0, 1fr) 58px 58px 46px 26px';

/** One row handed to the calculator: a detail name and how many fit per sheet. */
export interface LayoutTransferItem {
  name: string;
  placed: number;
}

/** Names the calculator updated and created while applying the layout. */
export interface LayoutTransferReport {
  updated: string[];
  added: string[];
}

export interface LayoutPageProps {
  /**
   * App owns the calculator state, so the page only reports what to write.
   * Kept optional so the page can still be rendered standalone.
   */
  onTransferToCalculator?: (items: LayoutTransferItem[]) => LayoutTransferReport;
}

/**
 * Stable identity of a table row. Rows are editable and deletable, so an index
 * key would move the text draft of a removed row to its successor.
 */
let partSeq = 0;
function nextPartId(): string {
  partSeq += 1;
  return `part-${partSeq}`;
}

/** Digits with at most one decimal separator; anything else is not a number. */
const NUMERIC_TEXT = /^\d*[.,]?\d*$/;

/** Whole digits only, used by quantities. */
const NUMERIC_WHOLE = /^\d*$/;

interface NumberFieldProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Restricts the draft to whole numbers (quantities). */
  integer?: boolean;
  /** Accessible name for compact cells rendered without a visible label. */
  ariaLabel?: string;
}

/**
 * Numeric field that keeps the raw text while it is being edited: the value can
 * be cleared and re-typed, decimals may end with a separator, and external
 * updates (sheet presets) reach the field when it is not focused. Only valid
 * numbers are committed to the parent state.
 */
const NumberField = ({
  label,
  value,
  onChange,
  min = 0,
  integer = false,
  ariaLabel,
}: NumberFieldProps) => {
  const [draft, setDraft] = useState(() => String(value));
  const [focused, setFocused] = useState(false);

  // Pull external changes (presets) into the field while it is not being edited.
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const parse = (raw: string): number => parseFloat(raw.replace(',', '.'));

  const handleChange = (raw: string) => {
    if (!(integer ? NUMERIC_WHOLE : NUMERIC_TEXT).test(raw)) return;
    setDraft(raw);
    const parsed = parse(raw);
    if (Number.isFinite(parsed) && parsed >= min) onChange(integer ? Math.floor(parsed) : parsed);
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parse(draft);
    const next = Number.isFinite(parsed) ? Math.max(min, parsed) : value;
    const normalized = integer ? Math.floor(next) : next;
    setDraft(String(normalized));
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label ? (
        <Typography.Text style={{ fontSize: 12, color: '#5f6368' }}>{label}</Typography.Text>
      ) : null}
      <Input
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        inputMode="decimal"
        aria-label={ariaLabel ?? label}
        style={{ borderRadius: 8, backgroundColor: '#fff' }}
      />
    </div>
  );
};

/**
 * LayoutSvg only accepts a successful multi-part packing, while useLayout may
 * also return GridOk/GridError or PackError. The `placed` field distinguishes
 * PackOk from the other result types.
 */
function toPackOk(result: LayoutResult | null): PackOk | null {
  if (!result || !result.ok || !('placed' in result)) return null;
  return result;
}

/** Single-mode grid result, or null while another mode/invalid size is active. */
function toGridOk(result: LayoutResult | null): GridOk | null {
  if (!result || !result.ok || !('variants' in result)) return null;
  return result;
}

/** Error text of a failed engine run, or null for a successful/absent result. */
function errorOf(result: LayoutResult | null): string | null {
  if (!result || !('error' in result)) return null;
  return result.error;
}

/**
 * Russian wording of engine errors.
 *
 * The engine reports machine-readable English messages; the pane must not show
 * them to the user. Unknown messages fall through unchanged, so a new engine
 * error stays visible instead of being swallowed.
 */
const ENGINE_ERRORS: Record<string, string> = {
  'add at least one part': 'Добавьте хотя бы одну деталь.',
  'work area is not positive: reduce margin or flap':
    'Рабочая зона отрицательная! Уменьшите поля или клапан.',
  'no part fits the sheet with the given parameters':
    'Ни одна деталь не помещается на лист с заданными параметрами.',
  'no part fits the working area':
    'Ни одна деталь не помещается на лист с заданными параметрами.',
  'no part could be placed on the sheet':
    'Не удалось разместить ни одной детали на листе.',
};

/** Bad input is reported per part, e.g. "Дно: size must be positive". */
const BAD_SIZE_SUFFIX = ': size must be positive';
const INTERNAL_PREFIX = 'internal layout error: ';

function errorText(error: string): string {
  if (error.startsWith(INTERNAL_PREFIX)) {
    return 'Внутренняя ошибка раскладки: ' + error.slice(INTERNAL_PREFIX.length);
  }
  if (error.includes(BAD_SIZE_SUFFIX)) {
    return error.split(BAD_SIZE_SUFFIX).join(': размер должен быть больше нуля');
  }
  return ENGINE_ERRORS[error] ?? error;
}

/** Prototype thresholds: 80% and more is green, 60% and more orange. */
function utilizationColor(percent: number): string {
  if (percent >= 80) return '#0d7c3f';
  if (percent >= 60) return '#e8710a';
  return '#d32f2f';
}

/**
 * Russian wording of one "not placed" row.
 *
 * A noSpace row carries no quantity of its own, so the missing count of the
 * same type is used. Oversized parts never reach byType.
 */
function notPlacedText(item: NotPlacedItem, byType: ByTypeItem[]): string {
  if (item.reason === 'oversized') return 'не помещается в рабочую зону';
  if (item.reason === 'badInput') return 'некорректные размеры детали';

  const type = byType.find((b) => (item.partId ? b.partId === item.partId : b.name === item.name));
  return type && type.missing > 0
    ? `не хватило места на листе (осталось ${type.missing} шт.)`
    : 'не хватило места на листе';
}

/**
 * Multi-mode results of the prototype: the big placed count, the work-zone
 * utilisation bar, three summary cards, the per-type summary and the list of
 * parts that did not fit. Rendered under the packing drawing.
 */
const MultiMetrics = ({ result, sheet }: { result: PackOk; sheet: SheetSpec }) => {
  const utilWork = result.utilizationWork;
  const utilColor = utilizationColor(utilWork);
  const barWidth = Math.max(0, Math.min(100, utilWork));

  // How many parts of each type fit alone: the prototype asks the engine with
  // qty 999 and shows the badge only when the mix fits a different number.
  const aloneCounts = useMemo(
    () =>
      result.byType.map((type) => {
        const alone = packParts({
          sheet,
          parts: [{ name: type.name, L: type.L, W: type.W, qty: ALONE_QTY }],
        });
        return alone.ok ? alone.placedCount : 0;
      }),
    [result, sheet],
  );

  return (
    <>
      <div
        style={{
          marginTop: 16,
          marginBottom: 16,
          padding: 20,
          borderLeft: '4px solid #1a73e8',
          borderRadius: 10,
          backgroundColor: '#f8f9fa',
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: '#1a73e8' }}>
          {result.placedCount}
        </div>
        <Typography.Text style={{ display: 'block', fontSize: 14, color: '#666', marginTop: 4 }}>
          деталей размещается на листе
          {result.requestedCount > 0 ? ` (из ${result.requestedCount} заказанных)` : ''}
        </Typography.Text>
      </div>

      <div
        style={{
          marginTop: 12,
          marginBottom: 4,
          height: 10,
          borderRadius: 6,
          backgroundColor: '#eceff1',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: 6,
            backgroundColor: utilColor,
            transition: 'width 0.3s',
          }}
        />
      </div>

      <div
        style={{
          marginTop: 14,
          marginBottom: 4,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}
      >
        <div
          style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #ececec',
            borderRadius: 9,
            padding: '10px 12px',
          }}
        >
          <Typography.Text
            style={{
              display: 'block',
              fontSize: 10,
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Загрузка рабочей зоны
          </Typography.Text>
          <div style={{ marginTop: 2, fontSize: 18, fontWeight: 700, color: utilColor }}>
            {utilWork.toFixed(1)}%
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #ececec',
            borderRadius: 9,
            padding: '10px 12px',
          }}
        >
          <Typography.Text
            style={{
              display: 'block',
              fontSize: 10,
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Загрузка листа
          </Typography.Text>
          <div style={{ marginTop: 2, fontSize: 18, fontWeight: 700, color: '#0d7c3f' }}>
            {result.utilizationSheet.toFixed(1)}%
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #ececec',
            borderRadius: 9,
            padding: '10px 12px',
          }}
        >
          <Typography.Text
            style={{
              display: 'block',
              fontSize: 10,
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Листов на заказ
          </Typography.Text>
          <div style={{ marginTop: 2, fontSize: 18, fontWeight: 700, color: '#333' }}>
            {result.sheetsForOrder || 1}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {result.byType.map((type, index) => {
          const alone = aloneCounts[index];
          return (
            <Flex
              key={`${type.partId ?? type.name}-${type.typeIndex}`}
              gap={10}
              align="center"
              style={{
                padding: '7px 10px',
                marginBottom: 6,
                borderRadius: 8,
                backgroundColor: '#f8f9fa',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  flex: '0 0 auto',
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: type.color.fill,
                  border: `1px solid ${type.color.stroke}`,
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  color: '#333',
                }}
              >
                {type.name}
              </div>
              <div style={{ color: '#666', fontVariantNumeric: 'tabular-nums' }}>
                {type.L}×{type.W} мм
              </div>
              <div
                style={{
                  color: type.missing === 0 ? '#0d7c3f' : '#d32f2f',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {type.placed} / {type.requested} шт
              </div>
              {alone !== type.placed && (
                <span title="Столько влезает, если резать только эту деталь" style={{ fontSize: 11, color: '#999' }}>
                  отдельно {alone} шт
                </span>
              )}
              {type.sheets ? (
                <span style={{ fontSize: 11, color: '#999' }}>{type.sheets} л.</span>
              ) : null}
            </Flex>
          );
        })}
      </div>

      {result.notPlaced.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 8,
            backgroundColor: '#fff8e1',
            borderLeft: '4px solid #f9ab00',
            fontSize: 13,
          }}
        >
          <Typography.Title
            level={5}
            style={{ fontSize: 13, fontWeight: 600, color: '#b06000', marginBottom: 6, marginTop: 0 }}
          >
            <ExclamationCircleOutlined style={{ marginRight: 8 }} />
            Не разместилось на листе
          </Typography.Title>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#795548' }}>
            {result.notPlaced.map((item, index) => (
              <li key={`${item.partId ?? item.name}-${item.reason}-${index}`}>
                {item.name} — {notPlacedText(item, result.byType)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export const LayoutPage = ({ onTransferToCalculator }: LayoutPageProps) => {
  const {
    sheet,
    setSheet,
    parts,
    setParts,
    singlePart,
    setSinglePart,
    mode,
    setMode,
    result,
    isCalculating,
  } = useLayout();

  const [transferStatus, setTransferStatus] = useState<string | null>(null);

  const packResult = toPackOk(result);
  const grid = toGridOk(result);
  const error = errorOf(result);
  // packParts reports an empty list as an error; the pane shows a calmer hint.
  const isMultiEmpty = mode === 'multi' && parts.length === 0;

  // A new layout invalidates the report of the previous transfer.
  useEffect(() => {
    setTransferStatus(null);
  }, [result]);

  // Multi mode sends exactly the byType rows of the current packing; single
  // mode has no byType, so it sends the best grid count of the edited part.
  const transferItems = useMemo<LayoutTransferItem[]>(() => {
    if (mode === 'multi') {
      return (packResult?.byType ?? [])
        .filter((type) => type.placed > 0)
        .map((type) => ({ name: type.name, placed: type.placed }));
    }

    const name = singlePart.name.trim();
    return grid && name ? [{ name, placed: grid.best.total }] : [];
  }, [mode, packResult, grid, singlePart.name]);

  const canTransfer =
    Boolean(onTransferToCalculator) && transferItems.length > 0 && !isCalculating;

  const transferHint =
    transferItems.length === 0
      ? 'Сначала рассчитайте раскладку — передавать будет нечего.'
      : `Передаст в расчёт: ${transferItems
          .map((item) => `${item.name} — ${item.placed} шт/лист`)
          .join(', ')}.`;

  const handleTransfer = () => {
    if (!canTransfer || !onTransferToCalculator) return;

    const report = onTransferToCalculator(transferItems);
    const changes = [
      report.updated.length > 0 ? `обновлено: ${report.updated.join(', ')}` : '',
      report.added.length > 0 ? `добавлено: ${report.added.join(', ')}` : '',
    ].filter(Boolean);

    setTransferStatus(changes.length > 0 ? changes.join(' · ') : 'изменений нет');
  };

  const handleAddPart = () => {
    const id = nextPartId();
    setParts((prev) => [...prev, { id, ...DEFAULT_PART, name: `Деталь ${prev.length + 1}` }]);
  };

  /** Edits one cell of the parts table; the engine recalculates on state change. */
  const updatePart = (index: number, patch: Partial<PartInput>) => {
    setParts((prev) => prev.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  };

  const handleRemovePart = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Typography.Title level={4} style={{ fontWeight: 600, color: '#202124', marginBottom: 4 }}>
        Раскладка деталей
      </Typography.Title>
      <Typography.Text
        style={{ display: 'block', fontSize: 13, color: '#5f6368', marginBottom: 16 }}
      >
        Настройте лист и добавьте детали — раскладка пересчитается автоматически.
      </Typography.Text>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Controls */}
        <Card
          style={{
            width: '100%',
            maxWidth: 420,
            flexShrink: 0,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
          variant="borderless"
          styles={{ body: { padding: 16 } }}
        >
          <Tabs
            activeKey={mode}
            onChange={(key) => setMode(key as LayoutMode)}
            aria-label="Режим раскладки"
            items={[
              { key: 'single', label: 'Одна деталь' },
              { key: 'multi', label: 'Несколько деталей' },
            ]}
            style={{ marginBottom: 16 }}
          />

          <Typography.Text strong style={{ display: 'block', fontSize: 16, marginBottom: 12 }}>
            Параметры листа
          </Typography.Text>

          <Typography.Text strong style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
            Быстрый выбор формата
          </Typography.Text>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {SHEET_PRESETS.map((preset) => {
              const active = sheet.sheetL === preset.sheetL && sheet.sheetW === preset.sheetW;
              return (
                <Button
                  key={preset.label}
                  size="small"
                  aria-pressed={active}
                  onClick={() =>
                    setSheet((prev) => ({ ...prev, sheetL: preset.sheetL, sheetW: preset.sheetW }))
                  }
                  style={{
                    padding: '6px 0',
                    height: 'auto',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    borderColor: active ? '#1a73e8' : '#dadce0',
                    backgroundColor: active ? '#e8f0fe' : '#fff',
                    color: active ? '#1a73e8' : '#3c4043',
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>

          <Flex vertical gap={12}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumberField
                label="Длина листа, мм"
                value={sheet.sheetL}
                onChange={(sheetL) => setSheet((prev) => ({ ...prev, sheetL }))}
              />
              <NumberField
                label="Ширина листа, мм"
                value={sheet.sheetW}
                onChange={(sheetW) => setSheet((prev) => ({ ...prev, sheetW }))}
              />
            </div>

            {mode === 'single' && (
              <>
                <Typography.Text strong style={{ display: 'block', fontSize: 14, marginTop: 8 }}>
                  Деталь
                </Typography.Text>

                <Input
                  value={singlePart.name}
                  onChange={(event) =>
                    setSinglePart((prev) => ({ ...prev, name: event.target.value }))
                  }
                  maxLength={30}
                  placeholder="Название детали"
                  style={{ borderRadius: 8, backgroundColor: '#fff' }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <NumberField
                    label="Длина, мм"
                    value={singlePart.L}
                    min={1}
                    onChange={(L) => setSinglePart((prev) => ({ ...prev, L }))}
                  />
                  <NumberField
                    label="Ширина, мм"
                    value={singlePart.W}
                    min={1}
                    onChange={(W) => setSinglePart((prev) => ({ ...prev, W }))}
                  />
                </div>
              </>
            )}

            <NumberField
              label="Поле, мм"
              value={sheet.margin}
              onChange={(margin) => setSheet((prev) => ({ ...prev, margin }))}
            />
            <NumberField
              label="Клапан, мм"
              value={sheet.flap}
              onChange={(flap) => setSheet((prev) => ({ ...prev, flap }))}
            />
            <NumberField
              label="Зазор, мм"
              value={sheet.gap}
              onChange={(gap) => setSheet((prev) => ({ ...prev, gap }))}
            />
            <Checkbox
              checked={sheet.allowRotate}
              onChange={(event) =>
                setSheet((prev) => ({ ...prev, allowRotate: event.target.checked }))
              }
            >
              Разрешить поворот
            </Checkbox>

            {mode === 'multi' && (
              <>
                <Button type="primary" onClick={handleAddPart}>
                  Добавить деталь
                </Button>

                <Typography.Text strong style={{ display: 'block', fontSize: 14, marginTop: 8 }}>
                  Детали: {parts.length}
                </Typography.Text>

                {parts.length === 0 ? (
                  <Typography.Text style={{ display: 'block', fontSize: 13, color: '#5f6368' }}>
                    Детали пока не добавлены
                  </Typography.Text>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: PART_ROW_COLUMNS,
                        gap: 4,
                        alignItems: 'center',
                        marginBottom: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#5f6368',
                      }}
                    >
                      <span />
                      <span>Название</span>
                      <span>Длина</span>
                      <span>Ширина</span>
                      <span>Кол-во</span>
                      <span />
                    </div>

                    <Flex vertical gap={4} style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {parts.map((part, index) => (
                        <div
                          key={part.id ?? index}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: PART_ROW_COLUMNS,
                            gap: 4,
                            alignItems: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              backgroundColor: paletteFor(index).stroke,
                            }}
                          />

                          <Input
                            value={part.name}
                            onChange={(event) => updatePart(index, { name: event.target.value })}
                            maxLength={30}
                            aria-label="Название детали"
                            style={{ borderRadius: 6, backgroundColor: '#fff', fontSize: 12, height: 28 }}
                          />

                          <NumberField
                            ariaLabel={`Длина детали ${index + 1}`}
                            value={part.L}
                            min={1}
                            onChange={(L) => updatePart(index, { L })}
                          />
                          <NumberField
                            ariaLabel={`Ширина детали ${index + 1}`}
                            value={part.W}
                            min={1}
                            onChange={(W) => updatePart(index, { W })}
                          />
                          <NumberField
                            ariaLabel={`Количество деталей ${index + 1}`}
                            value={part.qty}
                            min={1}
                            integer
                            onChange={(qty) => updatePart(index, { qty })}
                          />

                          <Button
                            size="small"
                            type="text"
                            danger
                            aria-label={`Удалить деталь ${index + 1}`}
                            onClick={() => handleRemovePart(index)}
                            style={{ width: 24, height: 24, padding: 0 }}
                            icon={<CloseOutlined style={{ fontSize: 15 }} />}
                          />
                        </div>
                      ))}
                    </Flex>
                  </>
                )}
              </>
            )}
          </Flex>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8eaed' }}>
            <Button
              type="primary"
              block
              disabled={!canTransfer}
              onClick={handleTransfer}
              style={{
                padding: '8px 0',
                borderRadius: 8,
                backgroundColor: '#0d7c3f',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              ➡ Передать в расчёт
            </Button>
            <Typography.Text
              style={{
                display: 'block',
                marginTop: 6,
                fontSize: 11.5,
                lineHeight: 1.45,
                color: transferStatus ? '#0d7c3f' : '#5f6368',
              }}
            >
              {transferStatus ? `✅ ${transferStatus}` : transferHint}
            </Typography.Text>
          </div>
        </Card>

        {/* Results */}
        <Card
          style={{
            width: '100%',
            flex: '1 1 320px',
            minWidth: 0,
            minHeight: 400,
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
          variant="borderless"
          styles={{ body: { padding: 24 } }}
        >
          <Typography.Title
            level={4}
            style={{ fontSize: 18, fontWeight: 500, color: '#333', marginBottom: 16, marginTop: 0 }}
          >
            <BarChartOutlined style={{ marginRight: 8 }} />
            Результат
          </Typography.Title>

          {isMultiEmpty ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
              <div style={{ lineHeight: 1, marginBottom: 12 }}>
                <PlusOutlined style={{ fontSize: 48, color: '#999' }} />
              </div>
              <Typography.Text style={{ display: 'block', fontSize: 14, color: '#999' }}>
                Добавьте хотя бы одну деталь в таблицу
              </Typography.Text>
            </div>
          ) : error ? (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                backgroundColor: '#ffebee',
                color: '#d32f2f',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <ExclamationCircleOutlined style={{ marginRight: 8 }} />
              {errorText(error)}
            </div>
          ) : (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                backgroundColor: '#fafafa',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                overflow: 'auto',
                textAlign: 'center',
              }}
            >
              {grid && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 16,
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#1a73e8',
                  }}
                >
                  Максимум на листе: {grid.best.total} шт. ({grid.best.cols}×{grid.best.rows},{' '}
                  {grid.best.isRotated ? 'поворот 90°' : 'без поворота'})
                </div>
              )}

              <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
                {mode === 'single' ? (
                  <LayoutSvgSingle result={grid} sheet={sheet} />
                ) : (
                  <LayoutSvg result={packResult} sheet={sheet} />
                )}

                {isCalculating && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <Flex vertical align="center" gap={8}>
                      <Spin size="large" />
                      <Typography.Text type="secondary">Расчёт…</Typography.Text>
                    </Flex>
                  </div>
                )}
              </div>

              <Button
                type="primary"
                aria-label="Печать раскладки"
                onClick={() => window.print()}
                style={{
                  marginTop: 12,
                  padding: '6px 20px',
                  borderRadius: 6,
                  backgroundColor: '#5f6368',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                }}
              >
                <PrinterOutlined style={{ marginRight: 8 }} />
                Печать
              </Button>
            </div>
          )}

          {packResult && <MultiMetrics result={packResult} sheet={sheet} />}
        </Card>
      </div>
    </div>
  );
};

