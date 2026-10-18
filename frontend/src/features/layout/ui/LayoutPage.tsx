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
 * summary cards. Single mode also prints a compact count in the panel.
 *
 * The left panel ends with "Передать в расчёт": it sends the placed counts of
 * the current result to the calculator through an App-owned callback.
 */
import { useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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

/** Shared look of the three summary cards under the packing drawing. */
const METRIC_CARD_SX = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #ececec',
  borderRadius: '9px',
  px: '12px',
  py: '10px',
} as const;

const METRIC_LABEL_SX = {
  fontSize: 10,
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
} as const;

const METRIC_VALUE_SX = {
  mt: '2px',
  fontSize: 18,
  fontWeight: 700,
  color: '#333',
} as const;

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
    <TextField
      fullWidth
      size="small"
      type="text"
      label={label}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      inputProps={{ inputMode: 'decimal', 'aria-label': ariaLabel }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          backgroundColor: '#fff',
        },
      }}
    />
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
      <Box
        sx={{
          mt: 2,
          mb: 2,
          p: 2.5,
          borderLeft: '4px solid #1a73e8',
          borderRadius: '10px',
          backgroundColor: '#f8f9fa',
        }}
      >
        <Box sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: '#1a73e8' }}>
          {result.placedCount}
        </Box>
        <Typography sx={{ fontSize: 14, color: '#666', mt: 0.5 }}>
          деталей размещается на листе
          {result.requestedCount > 0 ? ` (из ${result.requestedCount} заказанных)` : ''}
        </Typography>
      </Box>

      <Box
        sx={{
          mt: 1.5,
          mb: 0.5,
          height: 10,
          borderRadius: '6px',
          backgroundColor: '#eceff1',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: '6px',
            backgroundColor: utilColor,
            transition: 'width 0.3s',
          }}
        />
      </Box>

      <Box
        sx={{
          mt: '14px',
          mb: '4px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}
      >
        <Box sx={METRIC_CARD_SX}>
          <Typography sx={METRIC_LABEL_SX}>Загрузка рабочей зоны</Typography>
          <Box sx={{ ...METRIC_VALUE_SX, color: utilColor }}>{utilWork.toFixed(1)}%</Box>
        </Box>

        <Box sx={METRIC_CARD_SX}>
          <Typography sx={METRIC_LABEL_SX}>Загрузка листа</Typography>
          <Box sx={{ ...METRIC_VALUE_SX, color: '#0d7c3f' }}>
            {result.utilizationSheet.toFixed(1)}%
          </Box>
        </Box>

        <Box sx={METRIC_CARD_SX}>
          <Typography sx={METRIC_LABEL_SX}>Листов на заказ</Typography>
          <Box sx={METRIC_VALUE_SX}>{result.sheetsForOrder || 1}</Box>
        </Box>
      </Box>

      <Box sx={{ mt: '14px' }}>
        {result.byType.map((type, index) => {
          const alone = aloneCounts[index];
          return (
            <Box
              key={`${type.partId ?? type.name}-${type.typeIndex}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                px: '10px',
                py: '7px',
                mb: '6px',
                borderRadius: '8px',
                backgroundColor: '#f8f9fa',
                fontSize: 13,
              }}
            >
              <Box
                sx={{
                  flex: '0 0 auto',
                  width: 10,
                  height: 10,
                  borderRadius: '3px',
                  backgroundColor: type.color.fill,
                  border: `1px solid ${type.color.stroke}`,
                }}
              />
              <Box
                sx={{
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
              </Box>
              <Box sx={{ color: '#666', fontVariantNumeric: 'tabular-nums' }}>
                {type.L}×{type.W} мм
              </Box>
              <Box
                sx={{
                  color: type.missing === 0 ? '#0d7c3f' : '#d32f2f',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {type.placed} / {type.requested} шт
              </Box>
              {alone !== type.placed && (
                <Box
                  component="span"
                  title="Столько влезает, если резать только эту деталь"
                  sx={{ fontSize: 11, color: '#999' }}
                >
                  отдельно {alone} шт
                </Box>
              )}
              {type.sheets ? (
                <Box component="span" sx={{ fontSize: 11, color: '#999' }}>
                  {type.sheets} л.
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>

      {result.notPlaced.length > 0 && (
        <Box
          sx={{
            mt: 1.5,
            px: '14px',
            py: '12px',
            borderRadius: '8px',
            backgroundColor: '#fff8e1',
            borderLeft: '4px solid #f9ab00',
            fontSize: 13,
          }}
        >
          <Typography
            component="h3"
            sx={{ fontSize: 13, fontWeight: 600, color: '#b06000', mb: '6px' }}
          >
            ⚠️ Не разместилось на листе
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: '18px', color: '#795548' }}>
            {result.notPlaced.map((item, index) => (
              <li key={`${item.partId ?? item.name}-${item.reason}-${index}`}>
                {item.name} — {notPlacedText(item, result.byType)}
              </li>
            ))}
          </Box>
        </Box>
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
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124', mb: 0.5 }}>
        Раскладка деталей
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#5f6368', mb: 2 }}>
        Настройте лист и добавьте детали — раскладка пересчитается автоматически.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        {/* Controls */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', md: 420 },
            flexShrink: 0,
            p: 2,
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          <Tabs
            value={mode}
            onChange={(_event: SyntheticEvent, value: LayoutMode) => setMode(value)}
            variant="fullWidth"
            aria-label="Режим раскладки"
            sx={{
              minHeight: 36,
              mb: 2,
              p: '4px',
              backgroundColor: '#f1f3f4',
              borderRadius: '10px',
              '& .MuiTabs-flexContainer': { gap: '8px' },
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                minHeight: 32,
                minWidth: 0,
                px: '6px',
                py: '7px',
                fontSize: 13,
                fontWeight: 600,
                color: '#5f6368',
                textTransform: 'none',
                borderRadius: '7px',
                transition: 'all 0.15s',
              },
              '& .MuiTab-root:hover': { backgroundColor: '#e8f0fe' },
              '& .MuiTab-root.Mui-selected': {
                backgroundColor: '#fff',
                color: '#1a73e8',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              },
            }}
          >
            <Tab value="single" label="Одна деталь" disableRipple />
            <Tab value="multi" label="Несколько деталей" disableRipple />
          </Tabs>

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Параметры листа
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
            Быстрый выбор формата
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
            {SHEET_PRESETS.map((preset) => {
              const active = sheet.sheetL === preset.sheetL && sheet.sheetW === preset.sheetW;
              return (
                <Button
                  key={preset.label}
                  variant="outlined"
                  size="small"
                  aria-pressed={active}
                  onClick={() =>
                    setSheet((prev) => ({ ...prev, sheetL: preset.sheetL, sheetW: preset.sheetW }))
                  }
                  sx={{
                    py: 0.75,
                    borderRadius: '8px',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'none',
                    borderColor: active ? '#1a73e8' : '#dadce0',
                    backgroundColor: active ? '#e8f0fe' : '#fff',
                    color: active ? '#1a73e8' : '#3c4043',
                    '&:hover': {
                      borderColor: '#1a73e8',
                      backgroundColor: active ? '#e8f0fe' : '#f8f9fa',
                    },
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </Box>

          <Stack spacing={1.5}>
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

            {mode === 'single' && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
                  Деталь
                </Typography>

                <TextField
                  fullWidth
                  size="small"
                  label="Название детали"
                  value={singlePart.name}
                  onChange={(event) =>
                    setSinglePart((prev) => ({ ...prev, name: event.target.value }))
                  }
                  inputProps={{ maxLength: 30 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: '#fff',
                    },
                  }}
                />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
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
                </Box>

                {grid && (
                  <Box
                    sx={{
                      px: 1.25,
                      py: 1,
                      borderRadius: '8px',
                      backgroundColor: '#e8f0fe',
                      color: '#0d47a1',
                      fontSize: 13,
                    }}
                  >
                    Максимум на листе: <strong>{grid.best.total} шт.</strong>
                    {` · ${grid.best.cols}×${grid.best.rows}${
                      grid.best.isRotated ? ' · поворот 90°' : ' · без поворота'
                    }`}
                  </Box>
                )}
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
            <FormControlLabel
              control={
                <Checkbox
                  checked={sheet.allowRotate}
                  onChange={(event) =>
                    setSheet((prev) => ({ ...prev, allowRotate: event.target.checked }))
                  }
                />
              }
              label="Разрешить поворот"
              sx={{ m: 0 }}
            />

            {mode === 'multi' && (
              <>
                <Button variant="contained" onClick={handleAddPart} sx={{ textTransform: 'none' }}>
                  Добавить деталь
                </Button>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
                  Детали: {parts.length}
                </Typography>

                {parts.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: '#5f6368' }}>
                    Детали пока не добавлены
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        fontSize: 12,
                      },
                      '& .MuiOutlinedInput-input': {
                        height: 20,
                        px: '6px',
                        py: '4px',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: PART_ROW_COLUMNS,
                        gap: '4px',
                        alignItems: 'center',
                        mb: 0.5,
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
                    </Box>

                    <Stack spacing={0.5} sx={{ maxHeight: 240, overflowY: 'auto' }}>
                      {parts.map((part, index) => (
                        <Box
                          key={part.id ?? index}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: PART_ROW_COLUMNS,
                            gap: '4px',
                            alignItems: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '3px',
                              backgroundColor: paletteFor(index).stroke,
                            }}
                          />

                          <TextField
                            size="small"
                            value={part.name}
                            onChange={(event) => updatePart(index, { name: event.target.value })}
                            inputProps={{ maxLength: 30, 'aria-label': 'Название детали' }}
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

                          <IconButton
                            size="small"
                            aria-label={`Удалить деталь ${index + 1}`}
                            onClick={() => handleRemovePart(index)}
                            sx={{ p: 0.25, width: 24, height: 24, color: '#5f6368' }}
                          >
                            <CloseIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>

          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e8eaed' }}>
            <Button
              fullWidth
              variant="contained"
              disabled={!canTransfer}
              onClick={handleTransfer}
              sx={{
                py: 1,
                borderRadius: '8px',
                backgroundColor: '#0d7c3f',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#0b6a36', boxShadow: 'none' },
                '&.Mui-disabled': { backgroundColor: '#f1f3f4', color: '#9aa0a6' },
              }}
            >
              ➡ Передать в расчёт
            </Button>
            <Typography
              sx={{
                mt: 0.75,
                fontSize: 11.5,
                lineHeight: 1.45,
                color: transferStatus ? '#0d7c3f' : '#5f6368',
              }}
            >
              {transferStatus ? `✅ ${transferStatus}` : transferHint}
            </Typography>
          </Box>
        </Paper>

        {/* Results */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', md: 'auto' },
            flex: 1,
            minWidth: 0,
            minHeight: 400,
            p: 3,
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 500, color: '#333', mb: 2 }}>
            📊 Результат
          </Typography>

          {isMultiEmpty ? (
            <Box sx={{ py: '60px', px: 2.5, textAlign: 'center', color: '#999' }}>
              <Box sx={{ fontSize: 48, lineHeight: 1, mb: 1.5 }}>➕</Box>
              <Typography sx={{ fontSize: 14, color: '#999' }}>
                Добавьте хотя бы одну деталь в таблицу
              </Typography>
            </Box>
          ) : error ? (
            <Box
              sx={{
                p: 2,
                borderRadius: '8px',
                backgroundColor: '#ffebee',
                color: '#d32f2f',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              ⚠️ {errorText(error)}
            </Box>
          ) : (
            <Box
              sx={{
                mt: 2.5,
                p: 2,
                backgroundColor: '#fafafa',
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                overflow: 'auto',
                textAlign: 'center',
              }}
            >
              <Box sx={{ position: 'relative', maxWidth: 720, mx: 'auto' }}>
                {mode === 'single' ? (
                  <LayoutSvgSingle result={grid} sheet={sheet} />
                ) : (
                  <LayoutSvg result={packResult} sheet={sheet} />
                )}

                {isCalculating && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <Stack alignItems="center" spacing={1}>
                      <CircularProgress size={36} />
                      <Typography variant="body2" color="text.secondary">
                        Расчёт…
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Box>

              <Button
                variant="contained"
                aria-label="Печать раскладки"
                onClick={() => window.print()}
                sx={{
                  mt: 1.5,
                  px: 2.5,
                  py: 1,
                  borderRadius: '6px',
                  backgroundColor: '#5f6368',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { backgroundColor: '#414549', boxShadow: 'none' },
                }}
              >
                🖨 Печать
              </Button>
            </Box>
          )}

          {packResult && <MultiMetrics result={packResult} sheet={sheet} />}
        </Paper>
      </Box>
    </Box>
  );
};

