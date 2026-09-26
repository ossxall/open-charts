// OPEN-CHARTS
// Copyright (C) 2026 Juan José Caballero Rey
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import type {
  ChartEngine,
  MainPane,
  SeriesDefinition,
} from "../../../src/core/types";
import type { ParamDescriptor } from "../../../src/utils/_paramValue";

/**
 * One ATR observation, mirroring `ATRValue` on the Python engine.
 *
 * `atr` is null until the series has seen `period` closed bars, so the
 * renderer has to skip the warm-up region rather than treat it as zero.
 */
export type ATRValue = {
  time: number;
  atr: number | null;
  tr: number;
  close: number;
  atr_pct: number | null;
};

interface ATRParams {
  lineWidth: number;
  period: ParamDescriptor;
  showPct: boolean;
  showTR: boolean;
}

export interface ATRConfig {
  id: string;
  label: string;
  color: string;
  layer: "background" | "foreground";
  priceTagColor: string;
  width?: string;
  height?: string;
  params: ATRParams;
}

const isWarm = (v: ATRValue | null | undefined): v is ATRValue =>
  v != null && typeof v.atr === "number" && Number.isFinite(v.atr);

export const ATR = (config: ATRConfig) => {
  const series: SeriesDefinition<ATRValue, ATRValue, ATRParams> = {
    id: config.id,
    label: config.label,
    color: config.color,
    layer: config.layer,
    priceTagColor: config.priceTagColor,
    width: config.width ?? "100%",
    height: config.height ?? "300px",
    params: config.params,

    // The ATR values are pre-computed by the backend, so no
    // recalculation happens here — data passes through unchanged.
    compute(data: ATRValue[]): ATRValue[] {
      return data;
    },

    render(
      ctx: CanvasRenderingContext2D,
      pane: MainPane,
      engine: ChartEngine,
      _data: ATRValue[],
      values: ATRValue[],
      params: ATRParams,
      priceMin: number,
      priceMax: number,
    ): void {
      // True range as a filled histogram behind the ATR line.
      if (params.showTR !== false) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        let started = false;
        for (
          let i = engine.viewStart;
          i < engine.viewEnd && i < values.length;
          i++
        ) {
          const point = values[i];
          if (!point) continue;
          const tr = point.tr;
          if (!Number.isFinite(tr)) continue;
          const x = engine.utils.xOf(i);
          const y = engine.utils.yOf(tr, pane, priceMin, priceMax);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        if (started) {
          const lastX = engine.utils.xOf(
            Math.min(engine.viewEnd, values.length) - 1,
          );
          const baseY = engine.utils.yOf(0, pane, priceMin, priceMax);
          ctx.lineTo(lastX, baseY);
          ctx.lineTo(engine.utils.xOf(engine.viewStart), baseY);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = this.color;
      ctx.lineWidth = params.lineWidth ?? 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      for (
        let i = engine.viewStart;
        i < engine.viewEnd && i < values.length;
        i++
      ) {
        // skip the warm-up bars, where atr is null
        if (!isWarm(values[i])) continue;
        const x = engine.utils.xOf(i);
        const y = engine.utils.yOf(
          values[i].atr as number,
          pane,
          priceMin,
          priceMax,
        );
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },

    // The backend already sends ATR values, so the incremental
    // update just appends/replaces the incoming point.
    updateIncremental(
      data: readonly ATRValue[],
      values: ATRValue[],
      isNewBar: boolean,
    ): void {
      if (data.length === 0) return;

      if (isNewBar) {
        values.push(data[data.length - 1]);
      } else {
        values[values.length - 1] = data[data.length - 1];
      }
    },

    tooltipRow(values: ATRValue[], i: number): any {
      const point = values[i];
      if (!isWarm(point)) return null;

      return {
        label: this.label || "ATR",
        value: (point.atr as number).toFixed(2),
        color: this.color,
      };
    },

    priceTags(data: ATRValue[], values: ATRValue[]) {
      // ATR is not a price level, so it gets no price tag on the axis.
      return [];
    },

    valueRange(
      data: ATRValue[],
      values: ATRValue[],
      start: number,
      end: number,
      params: ATRParams,
    ) {
      let lo = Infinity;
      let hi = -Infinity;

      const track = (v: number | null) => {
        if (v == null || !Number.isFinite(v)) return;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      };

      for (let i = start; i < end; i++) {
        const point = values[i];
        if (!point) continue;
        track(point.atr);
        if (params?.showTR !== false) track(point.tr);
      }

      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { lo: 0, hi: 1 };
      }

      // ATR is non-negative: keep the baseline on the pane.
      if (lo > 0) lo = 0;

      return { lo, hi };
    },

    legend(
      data: ATRValue[],
      values: ATRValue[],
      barIndex: number,
      params: ATRParams,
    ) {
      const point = values[barIndex];
      if (!isWarm(point)) return [];

      const items = [
        {
          label: this.label || "ATR",
          value: (point.atr as number).toFixed(2),
          color: this.color,
        },
      ];

      if (params?.showPct && point.atr_pct != null) {
        items.push({
          label: `${this.label || "ATR"}%`,
          value: (point.atr_pct * 100).toFixed(2) + "%",
          color: this.color,
        } as (typeof items)[number]);
      }

      return items;
    },
  };

  return series;
};
