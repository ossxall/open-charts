// OPEN-CHARTS
// Copyright (C) 2026 Juan José Caballero Rey
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import type { ChartEngine } from "../../../src/core/ChartEngine";
import type { MainPane, SeriesDefinition } from "../../../src/core/types";

/**
 * Dibuja una esfera pulida (verde o roja) sobre un contexto 2D.
 * Sombreado por degradado radial (sin malla, sin costuras), pensada
 * para dibujarse en serie (una por punto de dato) en un chart de trading.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x       centro X
 * @param {number} y       centro Y
 * @param {number} radius  radio
 * @param {'green'|'red'} color
 */
function drawSphere(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  let dark: string;
  let mid: string;
  let light: string;

  switch (color) {
    case "green":
      dark = "#06301A";
      mid = "#13A35C";
      light = "#9CFFC4";
      break;

    case "gray":
      dark = "rgba(47, 52, 56, 0.5)";
      mid = "rgba(122, 130, 138, 0)";
      light = "rgba(215, 220, 225, 0)";
      break;

    default: // red
      dark = "#3A0907";
      mid = "#D8362A";
      light = "#FFB2A6";
      break;
  }

  const lx = x - radius * 0.35;
  const ly = y - radius * 0.4;

  // cuerpo
  const body = ctx.createRadialGradient(
    lx,
    ly,
    radius * 0.05,
    lx,
    ly,
    radius * 1.6,
  );
  body.addColorStop(0, light);
  body.addColorStop(0.45, mid);
  body.addColorStop(1, dark);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(0.25, radius * 0.015);
  ctx.strokeStyle = dark;
  ctx.stroke();

  // brillo especular
  const hr = radius * 0.22;
  const hl = ctx.createRadialGradient(lx, ly, 0, lx, ly, hr);
  hl.addColorStop(0, "rgba(255,255,255,0.75)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(lx, ly, hr, 0, Math.PI * 2);
  ctx.fillStyle = hl;
  ctx.fill();
}

export type CandleBubble = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  start_ts: number;
  end_ts: number;

  buy_qty: number;
  sell_qty: number;
  delta_pct: number;
  signal: number;
  bubble_color: "green" | "red" | "gray";
  bubble_size: number;
  show_bubble: boolean;
  tick_count: number;
};

interface CandlestickParams {
  bullColor: string;
  bearColor: string;
}

export interface CandlestickConfig {
  id: string;
  label: string;
  color: string;
  layer: "background" | "foreground";
  priceTagColor: string;
  width?: string;
  height?: string;
  params: CandlestickParams;
}

export const Candlestick = (config: CandlestickConfig) => {
  const series: SeriesDefinition<
    CandleBubble,
    CandleBubble,
    CandlestickParams
  > = {
    id: config.id,
    label: config.label,
    color: config.color,
    layer: config.layer,
    priceTagColor: config.priceTagColor,
    width: config.width ?? "100%",
    height: config.height ?? "calc(100vh - (2.5rem * 3) - (0.25rem * 3))",
    params: config.params,

    compute(data: CandleBubble[]): any[] {
      return data;
    },

    render(
      ctx: CanvasRenderingContext2D,
      pane: MainPane,
      engine: ChartEngine,
      _data: CandleBubble[],
      values: CandleBubble[], // Mapeado a la estructura de datos OHLC
      params: CandlestickParams,
      priceMin: number,
      priceMax: number,
    ): void {
      // 1. Extraer configuraciones dinámicas de los params o usar defaults
      const bullCol = params.bullColor;
      const bearCol = params.bearColor;
      const fancyFill = false;

      // 2. Extraer propiedades de dibujo desde el motor (engine)
      // Nota: Adapté 'this.barWidth' a 'engine.barWidth' (común en estas librerías)
      const barWidth = engine.barWidth ?? 6;
      const bw = Math.max(1, barWidth - 1);
      const hw = Math.max(1, Math.floor(bw / 2));

      ctx.save();

      // 3. Bucle de renderizado optimizado para la vista actual
      for (
        let i = engine.viewStart;
        i < engine.viewEnd && i < values.length;
        i++
      ) {
        const d: CandleBubble = values[i];
        if (!d) continue;

        // Conversión de coordenadas usando los métodos del engine
        const x = Math.round(engine.utils.xOf(i));
        const yH = Math.round(
          engine.utils.yOf(d.high, pane, priceMin, priceMax),
        );
        const yL = Math.round(
          engine.utils.yOf(d.low, pane, priceMin, priceMax),
        );
        const yO = Math.round(
          engine.utils.yOf(d.open, pane, priceMin, priceMax),
        );
        const yC = Math.round(
          engine.utils.yOf(d.close, pane, priceMin, priceMax),
        );

        const bull = d.close >= d.open;
        const col = bull ? bullCol : bearCol;

        // --- Dibujo de las Mechas (Wicks) ---
        // +0.5 alinea el trazo de 1px exactamente al centro de los píxeles de la pantalla
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yH);
        ctx.lineTo(x + 0.5, yL);
        ctx.stroke();

        // --- Dibujo del Cuerpo (Body) ---
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(1, Math.abs(yC - yO));

        if (bw >= 2) {
          // Cuerpo sólido exterior
          ctx.fillStyle = col;
          ctx.fillRect(x - hw + 1, bodyTop, bw - 1, bodyH);

          // Efecto visual/relleno translúcido si hay suficiente espacio (Fancy Fill)
          if (fancyFill && bw >= 5 && bodyH > 2) {
            ctx.fillStyle = bull
              ? "rgba(0, 200, 122, 0.25)"
              : "rgba(255, 64, 96, 0.25)";
            ctx.fillRect(x - hw + 2, bodyTop + 1, bw - 3, bodyH - 2);
          }
        } else {
          // Si el zoom es muy lejano, dibuja el cuerpo como una línea vertical de 1px
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 0.5, bodyTop);
          ctx.lineTo(x + 0.5, bodyTop + bodyH);
          ctx.stroke();
        }

        if (d?.show_bubble) {
          const radius = Math.max(2, d.bubble_size); // ← quitar el * 0.5

          const bubbleOffset = 50;
          drawSphere(
            ctx,
            x,
            yL + radius + bubbleOffset,
            radius,
            d.bubble_color,
          );
        }
      }

      ctx.restore();
    },

    updateIncremental(
      data: readonly CandleBubble[],
      values: CandleBubble[],
      isNewBar: boolean,
    ): void {
      if (isNewBar) {
        values.push(data[data.length - 1]);
      } else {
        values[values.length - 1] = data[data.length - 1];
      }
    },

    // Fila del Tooltip para mostrar los valores OHLC en un formato legible
    tooltipRow(values: CandleBubble[], i: number): any {
      const d = values[i];
      if (!d) return null;

      const bull = d.close >= d.open;
      const col = bull ? this.params.bullColor : this.params.bearColor;

      return {
        label: "OHLC",
        value: `O:${d.open.toFixed(2)} H:${d.high.toFixed(2)} L:${d.low.toFixed(2)} C:${d.close.toFixed(2)}`,
        color: col,
      };
    },

    priceTags(data: CandleBubble[], values: CandleBubble[]) {
      const last = data.at(-1);

      if (!last) {
        return [];
      }

      return [
        {
          value: last.close,
          color: this.priceTagColor!,
          label: "",
        },
      ];
    },

    valueRange(
      data: CandleBubble[],
      values: CandleBubble[],
      start: number,
      end: number,
    ) {
      let lo = Infinity;
      let hi = -Infinity;

      for (let i = start; i < end; i++) {
        const bar = data[i];

        if (!bar) {
          continue;
        }

        lo = Math.min(lo, bar.low);
        hi = Math.max(hi, bar.high);
      }

      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { lo: 0, hi: 1 };
      }

      return { lo, hi };
    },

    legend(
      data: CandleBubble[],
      values: CandleBubble[],
      barIndex: number,
      params: CandlestickParams,
    ) {
      const d: CandleBubble = data[barIndex];

      if (!d) {
        return [];
      }

      const pct = ((d.close - d.open) / d.open) * 100;

      const bull = d.close >= d.open;
      const color = bull ? params.bullColor : params.bearColor;

      return [
        {
          label: "O",
          value: d.open.toFixed(2),
          color,
        },
        {
          label: "H",
          value: d.high.toFixed(2),
          color,
        },
        {
          label: "L",
          value: d.low.toFixed(2),
          color,
        },
        {
          label: "C",
          value: d.close.toFixed(2),
          color,
        },
        {
          label: "V",
          value: d.volume.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          }),
          color,
        },
        {
          label: "%",
          value: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
          color,
        },
      ];
    },
  };

  return series;
};
