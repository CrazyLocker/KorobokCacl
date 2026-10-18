/**
 * Visualisation of a multi-part packing result.
 *
 * Port of raspSvgFrame / raspGenerateMultiSVG from the prototype.
 * result.placed holds sheet working coordinates, so the origin of the working
 * area is added here: margin on X and flap + margin on Y. The packed group is
 * then centred inside the working area, exactly like the prototype does.
 *
 * The SVG is drawn in millimetres: viewBox matches the sheet size, so the
 * image scales to whatever container it is placed in.
 */
import { useId } from 'react';
import { paletteFor, round2 } from '../model/constants.ts';
import type { PackOk, Palette, SheetSpec } from '../model/types.ts';

export interface LayoutSvgProps {
  /** packParts output, or null while there is nothing to show. */
  result: PackOk | null;
  /** Sheet geometry; the frame is drawn from it even without a result. */
  sheet: SheetSpec;
}

/** Size label is drawn only when the part has room for 9 px text. */
export const LABEL_MIN_W = 34;
export const LABEL_MIN_H = 18;

/**
 * Palette of a part type.
 *
 * byType is built from valid parts only, so its index is not guaranteed to be
 * equal to typeIndex; the lookup by typeIndex is authoritative, with the
 * prototype palette as the last resort.
 */
function colorFor(result: PackOk, typeIndex: number): Palette {
  const byIndex = result.byType.find((b) => b.typeIndex === typeIndex) ?? result.byType[typeIndex];
  return byIndex?.color ?? paletteFor(typeIndex);
}

export const LayoutSvg = ({ result, sheet }: LayoutSvgProps) => {
  const hatchId = `flap-hatch-${useId().replace(/:/g, '')}`;

  const { sheetL, sheetW, margin, flap } = sheet;

  // Working area: margin on both sides, flap additionally eats the top edge.
  const workX = margin;
  const workY = flap + margin;
  const workW = Math.max(0, sheetL - margin * 2);
  const workH = Math.max(0, sheetW - flap - margin * 2);

  // Centre the packed group inside the working area without pulling it out.
  const offsetX = result ? Math.max(0, (result.workW - result.bounds.w) / 2) : 0;
  const offsetY = result ? Math.max(0, (result.workH - result.bounds.h) / 2) : 0;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${sheetL} ${sheetW}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Раскладка на листе ${sheetL}×${sheetW} мм`}
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

      {/* Placed parts */}
      {result ? (
        <g>
          {result.placed.map((item, index) => {
            const color = colorFor(result, item.typeIndex);
            const x = workX + offsetX + item.x;
            const y = workY + offsetY + item.y;
            const cx = x + item.w / 2;
            const cy = y + item.h / 2;
            const showLabel = item.w >= LABEL_MIN_W && item.h >= LABEL_MIN_H;

            return (
              <g key={index}>
                <rect
                  x={round2(x)}
                  y={round2(y)}
                  width={item.w}
                  height={item.h}
                  rx={1}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth={1.5}
                />
                {showLabel && (
                  <text
                    x={round2(cx)}
                    y={round2(item.rotated ? cy - 2 : cy + 4)}
                    fontFamily="Arial, sans-serif"
                    fontSize={9}
                    textAnchor="middle"
                    fill={color.text}
                  >
                    {item.w}×{item.h}
                  </text>
                )}
                {showLabel && item.rotated && (
                  <text
                    x={round2(cx)}
                    y={round2(cy + 9)}
                    fontFamily="Arial, sans-serif"
                    fontSize={8}
                    textAnchor="middle"
                    fill={color.stroke}
                  >
                    ↻ 90°
                  </text>
                )}
              </g>
            );
          })}
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
