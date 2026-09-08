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

import type {
  ChartEngine,
  MainPane,
  SeriesDefinition,
} from "../../../src/core/types";

export type EMAValue = {
  time: number;
  value: number;
  start_ts: number;
  end_ts: number;
};

interface EMAParams {
  lineWidth: number;
}

export interface EMAConfig {
  id: string;
  label: string;
  color: string;
  layer: "background" | "foreground";
  priceTagColor: string;
  width?: string;
  height?: string;
  params: EMAParams;
}

export const EMA = (config: EMAConfig) => {
  const series: SeriesDefinition<EMAValue, EMAValue, EMAParams> = {
    id: config.id,
    label: config.label,
    color: config.color,
    layer: config.layer,
    priceTagColor: config.priceTagColor,
    width: config.width ?? "100%",
    height: config.height ?? "500px",
    params: config.params,

    compute(data: EMAValue[]): any[] {
      return data;
    },

    render(
      ctx: CanvasRenderingContext2D,
      pane: MainPane,
      engine: ChartEngine,
      _data: EMAValue[],
      values: EMAValue[],
      params: EMAParams,
      priceMin: number,
      priceMax: number,
    ): void {
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
        if (values[i] === null) continue;
        const x = engine.utils.xOf(i);
        const y = engine.utils.yOf(values[i].value, pane, priceMin, priceMax);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },

    updateIncremental(
      data: readonly EMAValue[],
      values: EMAValue[],
      isNewBar: boolean,
    ): void {
      if (isNewBar) {
        values.push(data[data.length - 1]);
      } else {
        values[values.length - 1] = data[data.length - 1];
      }
    },

    tooltipRow(values: any[], i: number): any {
      if (values[i] === null) return null;
      return { label: "MA55", value: values[i].toFixed(2), color: "#ffb830" };
    },

    priceTags(data: EMAValue[], values: EMAValue[]) {
      const last = values.at(-1);
      if (!last) {
        return [];
      }

      return [
        {
          value: last.value,
          color: this.priceTagColor!,
          label: "",
        },
      ];
    },

    valueRange(
      data: EMAValue[],
      values: EMAValue[],
      start: number,
      end: number,
    ) {
      let lo = Infinity;
      let hi = -Infinity;

      for (let i = start; i < end; i++) {
        const ema = values[i];

        if (!ema) {
          continue;
        }

        lo = Math.min(lo, ema.value);
        hi = Math.max(hi, ema.value);
      }

      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { lo: 0, hi: 1 };
      }

      return { lo, hi };
    },

    legend(data: EMAValue[], values: EMAValue[], barIndex: number) {
      const d: EMAValue = data[barIndex];

      if (!d) {
        return [];
      }

      return [
        {
          label: "T",
          value: d.time.toFixed(2),
          color: this.color,
        },
      ];
    },
  };

  return series;
};
