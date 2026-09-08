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

import { PriceRange } from "../../../src/core/_visiblePriceRange";
import { drawHistogramSeries } from "../../helpers/drawHistogramSeries";
import type {
  ChartEngine,
  MainPane,
  PriceTag,
  SeriesDefinition,
} from "../../../src/core/types";

interface SqueezeValue {
  bcolor: string;
  end_ts: number;
  lowerBB: null | number;
  lowerKC: null | number;
  noSqz: boolean;
  scolor: string;
  sqzOff: boolean;
  sqzOn: boolean;
  start_ts: number;
  time: number;
  upperBB: null | number;
  upperKC: null | number;
  val: null | number;
}

interface SqueezeParams {
  length: number;
  mult: number;
  lengthKC: number;
  multKC: number;
  useTrueRange: boolean;
}

interface SqueezeConfig {
  id: string;
  label: string;
  color: string;
  layer: "background" | "foreground";
  priceTagColor: string;
  params: SqueezeParams;
}

export const SqueezeSeries = (config: SqueezeConfig) => {
  const series: SeriesDefinition<SqueezeValue, SqueezeValue, SqueezeParams> = {
    id: config.id,
    label: config.label,
    color: config.color,
    layer: config.layer,
    params: config.params,

    compute(data: SqueezeValue[]): any[] {
      return data;
    },

    render(
      ctx: CanvasRenderingContext2D,
      pane: MainPane,
      engine: ChartEngine,
      _data: SqueezeValue[],
      values: SqueezeValue[],
      _params: SqueezeParams,
      valueMin: number,
      valueMax: number,
    ) {
      drawHistogramSeries(
        ctx,
        pane,
        engine,
        values,
        valueMin,
        valueMax,
        (v: any) => v.val ?? NaN,
        (v: any) => v.bcolor,
      );

      // TODO:
      // Draw the squeeze dots at the zero line using v.squeezeColor.
    },

    updateIncremental(
      data: readonly SqueezeValue[],
      values: SqueezeValue[],
      isNewBar: boolean,
    ): void {
      if (isNewBar) {
        values.push(data[data.length - 1]);
      } else {
        values[values.length - 1] = data[data.length - 1];
      }
    },

    valueRange(
      data: SqueezeValue[],
      values: SqueezeValue[],
      start: number,
      end: number,
    ): PriceRange {
      let lo = Infinity;
      let hi = -Infinity;

      for (let i = start; i < end; i++) {
        const v = values[i];

        if (!v || v.val == null || !Number.isFinite(v.val)) {
          continue;
        }

        lo = Math.min(lo, v.val);
        hi = Math.max(hi, v.val);
      }

      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { lo: -1, hi: 1 };
      }

      return {
        lo: Math.min(lo, 0),
        hi: Math.max(hi, 0),
      };
    },

    tooltipRow(values, index) {
      const v = values[index];

      if (!v) {
        return null;
      }

      if (v.val == null) {
        return null;
      }

      return {
        label: "SQZMOM",
        value: v.val.toFixed(2),
        color: "red",
      };
    },

    priceTags(
      data: SqueezeValue[],
      values: SqueezeValue[],
    ): readonly PriceTag[] {
      const last = values.at(-1);

      if (!last || !Number.isFinite(last.val)) {
        return [];
      }

      return [
        {
          value: last.val || 0,
          color: "red",
          label: "SQZMOM",
        },
      ];
    },

    legend(data: SqueezeValue[], values: SqueezeValue[], barIndex: number) {
      const d: SqueezeValue = data[barIndex];

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
