/**
 * Visualisation of a single-part grid layout.
 *
 * Port of raspGenerateSVG from the prototype. The sheet frame, the hatched flap
 * and the margin labels are drawn from the sheet spec, so the canvas stays
 * readable even before a result exists. The grid comes from GridOk.best: every
 * cell is detailW x detailH, cells are separated by the technology gap and the
 * whole group is centred inside the working area, exactly like the prototype.
 *
 * Colours follow the prototype single mode: blue for 0 degrees, red for 90.
 */
import { useId } from 'react';
import { round2 } from '../model/constants.ts';
import type { GridOk, Palette, SheetSpec } from '../model/types.ts';
import { LABEL_MIN_H, LABEL_MIN_W } from './LayoutSvg.tsx';

export interface LayoutSvgSingleProps {
  /** gridLayout output, or null while the part does not fit yet. */
  result: GridOk | null;
  /** Sheet geometry; the frame is drawn from it even without a result. */
  sheet: SheetSpec;
}

/** Prototype palette of the single mode. */
const SINGLE_PALETTE: Record<'flat' | 'rotated', Palette> = {
  flat: { fill: '#e3f0ff', stroke: '#1a73e8', text: '#1a73e8' },
  rotated: { fill: '#fce8e8', stroke: '#d32f2f', text: '#d32f2f' },
};

/** Margin labels are hidden below this margin: they would be clipped. */
const MARGIN_LABEL_MIN = 8;

export const LayoutSvgSingle = ({ result, sheet }: LayoutSvgSingleProps) => {
  const hatchId = `flap-hatch-${useId().replace(/:/g, '')}`;

  const { sheetL, sheetW, margin, flap } = sheet;

  // Working area: margin on both sides, flap additionally eats the top edge.
  const workX = margin;
  const workY = flap + margin;
  const workW = Math.max(0, sheetL - margin * 2);
  const workH = Math.max(0, sheetW - flap - margin * 2);

  const variant = result ? result.best : null;
  const gap = result ? result.gap : sheet.gap;

  // Centre the grid inside the working area without pulling it out.
  const offsetX = variant ? Math.max(0, (workW - variant.groupWidth) / 2) : 0;
  const offsetY = variant ? Math.max(0, (workH - variant.groupHeight) / 2) : 0;

  const palette = variant?.isRotated ? SINGLE_PALETTE.rotated : SINGLE_PALETTE.flat;
  const showLabel =
    variant !== null && variant.detailW >= LABEL_MIN_W && variant.detailH >= LABEL_MIN_H;

  const cells: Array<{ x: number; y: number }> = [];
  if (variant) {
    for (let row = 0; row < variant.rows; row += 1) {
      for (let col = 0; col < variant.cols; col += 1) {
        cells.push({
          x: workX + offsetX + col * (variant.detailW + gap),
          y: workY + offsetY + row * (variant.detailH + gap),
        });
      }
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${sheetL} ${sheetW}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Сетка деталей на листе ${sheetL}×${sheetW} мм`}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        aspectRatio: `${sheetL} / ${sheetW}`,
      }}
    >
      <defs>
        <pattern
          id={hatchId}
          patternUnits="userSpaceOnUse"
          width="8"
          height="8"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#ff1744" strokeWidth="2.5" />
        </pattern>
      </defs>

      {/* Sheet border */}
      <rect
        x={0}
        y={0}
        width={sheetL}
        height={sheetW}
        fill="#fafafa"
        stroke="#333"
        strokeWidth={2}
      />

      {/* Flap: unusable strip along the top edge, hatched like the prototype */}
      {flap > 0 && (
        <>
          <rect x={0} y={0} width={sheetL} height={flap} fill={`url(#${hatchId})`} />
          <rect
            x={0}
            y={0}
            width={sheetL}
            height={flap}
            fill="none"
            stroke="#d50000"
            strokeWidth={2}
          />
          {flap >= 12 && (
            <text
              x={sheetL / 2}
              y={flap / 2 + 3}
              fontFamily="Arial, sans-serif"
              fontSize={9}
              fill="#a00"
              textAnchor="middle"
            >
              Клапан {flap} мм
            </text>
          )}
        </>
      )}

      {/* Working area boundary */}
      <rect
        x={workX}
        y={workY}
        width={workW}
        height={workH}
        fill="none"
        stroke="#999"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Margin labels; drawn under the cells, so a dense grid hides them */}
      {margin >= MARGIN_LABEL_MIN && (
        <g fontFamily="Arial, sans-serif" fontSize={9} fill="#999" textAnchor="middle">
          <text x={sheetL / 2} y={flap + 14}>
            Поле {margin} мм
          </text>
          <text x={sheetL / 2} y={sheetW - 4}>
            Поле {margin} мм
          </text>
          <text
            x={margin / 2 + 4}
            y={sheetW / 2 + 3}
            transform={`rotate(-90 ${margin / 2 + 4} ${sheetW / 2 + 3})`}
          >
            Поле {margin} мм
          </text>
          <text
            x={sheetL - margin / 2 - 4}
            y={sheetW / 2 + 3}
            transform={`rotate(90 ${sheetL - margin / 2 - 4} ${sheetW / 2 + 3})`}
          >
            Поле {margin} мм
          </text>
        </g>
      )}

      {/* Grid: rows x cols of identical cells, centred inside the working area */}
      {variant ? (
        <g>
          {cells.map((cell, index) => (
            <g key={index}>
              <rect
                x={round2(cell.x)}
                y={round2(cell.y)}
                width={variant.detailW}
                height={variant.detailH}
                rx={1}
                fill={palette.fill}
                stroke={palette.stroke}
                strokeWidth={1.5}
              />
              {showLabel && (
                <text
                  x={round2(cell.x + variant.detailW / 2)}
                  y={round2(cell.y + variant.detailH / 2 + 4)}
                  fontFamily="Arial, sans-serif"
                  fontSize={9}
                  textAnchor="middle"
                  fill={palette.text}
                >
                  {variant.detailW}×{variant.detailH}
                </text>
              )}
            </g>
          ))}
        </g>
      ) : (
        <text
          x={sheetL / 2}
          y={sheetW / 2}
          fontFamily="Arial, sans-serif"
          fontSize={12}
          textAnchor="middle"
          fill="#999"
        >
          Нет данных для раскладки
        </text>
      )}
    </svg>
  );
};
