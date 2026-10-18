/**
 * Layout page: sheet parameters and one part or the part list on the left,
 * packing preview on the right.
 *
 * The mode switch follows the prototype: single mode edits one part, multi mode
 * edits the part list. Sheet presets and the parts table only change state; the
 * canvas renders LayoutSvgSingle for a GridOk (single mode) and LayoutSvg for a
 * PackOk (multi mode). Engine failures are reported above the canvas; single
 * mode also prints a compact count in the panel.
 */
import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  Alert,
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
import { useLayout } from '../hooks/useLayout.ts';
import type { LayoutMode, LayoutResult } from '../hooks/useLayout.ts';
import type { GridOk, PackOk, PartInput } from '../model/types.ts';
import { LayoutSvg } from './LayoutSvg.tsx';
import { LayoutSvgSingle } from './LayoutSvgSingle.tsx';

/** Part added by the button; the name is generated on every click. */
const DEFAULT_PART = { L: 100, W: 180, qty: 1 } as const;

/** Quick sheet formats of the prototype. Clicking one overwrites sheetL/sheetW. */
const SHEET_PRESETS = [
  { label: '350×333', sheetL: 350, sheetW: 333 },
  { label: '500×350', sheetL: 500, sheetW: 350 },
  { label: '700×500', sheetL: 700, sheetW: 500 },
  { label: '1000×700', sheetL: 1000, sheetW: 700 },
] as const;

/** Columns of one parts-table row: colour, name, L, W, qty, delete. */
const PART_ROW_COLUMNS = '10px minmax(0, 1fr) 58px 58px 46px 26px';

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

export const LayoutPage = () => {
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

  const packResult = toPackOk(result);
  const grid = toGridOk(result);
  const error = errorOf(result);

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
        </Paper>

        {/* Preview */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', md: 'auto' },
            flex: 1,
            minWidth: 0,
            p: 2,
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          {error && (mode === 'single' || parts.length > 0) && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Не удалось выполнить раскладку: {error}
            </Alert>
          )}

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
        </Paper>
      </Box>
    </Box>
  );
};

