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
  PriceTag,
  SeriesDefinition,
} from "../../../src/core/types";
import type { ParamDescriptor } from "../../../src/utils/_paramValue";
import { drawLineSeries } from "../../helpers/drawLineSeries";

/**
 * ReversalTrapValue mirrors the engine's `ReversalTrapValue` dataclass so
 * every exposed field arrives as-is. The indicator math is fully computed by
 * the backend (see `ReversalTrap.py`), so this series is a pass-through.
 */
export type ReversalTrapValue = {
  // ----------------------------------------------------------------
  // Bar metadata
  // ----------------------------------------------------------------
  time: number;
  start_ts: number;
  end_ts: number;
  bar_index: number;

  // ----------------------------------------------------------------
  // Public output (bands / momentum)
  // ----------------------------------------------------------------
  basis: number | null;
  upper_band: number | null;
  lower_band: number | null;
  atr_envelope: number | null;
  rsi: number | null;
  rsi_bucket: number | null;
  atr_stop: number | null;
  bull_stop_level: number | null;
  bear_stop_level: number | null;

  // ----------------------------------------------------------------
  // Trap flags / envelope counters
  // ----------------------------------------------------------------
  raw_bull_trap: boolean;
  raw_bear_trap: boolean;
  bull_trap: boolean;
  bear_trap: boolean;
  close_above_envelope_count: number;
  close_below_envelope_count: number;

  // ----------------------------------------------------------------
  // Trade tracking
  // ----------------------------------------------------------------
  active_bull: boolean;
  active_bear: boolean;
  bull_bucket: number | null;
  bear_bucket: number | null;
  bull_target_price: number | null;
  bull_stop_price: number | null;
  bear_target_price: number | null;
  bear_stop_price: number | null;
  bull_entry_bar: number | null;
  bear_entry_bar: number | null;
  allowed_by_limits: boolean;

  // ----------------------------------------------------------------
  // Historical win/loss database (var arrays of 11 buckets)
  // ----------------------------------------------------------------
  bull_total: readonly number[];
  bull_wins: readonly number[];
  bear_total: readonly number[];
  bear_wins: readonly number[];
  total_trades_count: number;

  // ----------------------------------------------------------------
  // Internal continuity state (sent for hot-reload compatibility)
  // ----------------------------------------------------------------
  high: number;
  low: number;
  close: number;
  last_signal_bar: number;
  ema_value: number | null;
  ema_sum: number;
  ema_count: number;
  atr55_value: number | null;
  atr55_sum: number;
  atr55_count: number;
  atr100_value: number | null;
  atr100_sum: number;
  atr100_count: number;
  rsi_up_value: number | null;
  rsi_up_sum: number;
  rsi_down_value: number | null;
  rsi_down_sum: number;
  rsi_count: number;
};

interface ReversalTrapParams {
  envelope_len: number | ParamDescriptor;
  multiplier: number | ParamDescriptor;
  trap_window: number | ParamDescriptor;
  signal_gap: number | ParamDescriptor;
  rsi_len: number | ParamDescriptor;
  stop_mult: number | ParamDescriptor;
  max_bars: number | ParamDescriptor;
  max_trades: number | ParamDescriptor;
  atr_len: number | ParamDescriptor;
  target_source: string | ParamDescriptor;
  lineWidth: number;
}

export interface ReversalTrapConfig {
  id: string;
  label: string;
  color: string;
  layer: "background" | "foreground";
  priceTagColor: string;
  width?: string;
  height?: string;
  params: ReversalTrapParams;
}

const COLOR_UPPER = "#089981";
const COLOR_LOWER = "#F23645";
const COLOR_BULL_MARKER = "#13A35C";
const COLOR_BEAR_MARKER = "#D8362A";

export const ReversalTrap = (config: ReversalTrapConfig) => {
  const series: SeriesDefinition<
    ReversalTrapValue,
    ReversalTrapValue,
    ReversalTrapParams
  > = {
    id: config.id,
    label: config.label,
    color: config.color,
    layer: config.layer,
    priceTagColor: config.priceTagColor,
    width: config.width ?? "100%",
    height: config.height ?? "500px",
    params: config.params,

    // The ReversalTrap bands are pre-computed by the backend, so no
    // recalculation happens here — data passes through unchanged.
    compute(data: ReversalTrapValue[]): ReversalTrapValue[] {
      return data;
    },

    render(
      ctx: CanvasRenderingContext2D,
      pane: MainPane,
      engine: ChartEngine,
      _data: ReversalTrapValue[],
      values: ReversalTrapValue[],
      params: ReversalTrapParams,
      priceMin: number,
      priceMax: number,
    ): void {
      if (values.length < 2) return;

      const lineWidth = params.lineWidth ?? 1.5;

      // Basis Line
      drawLineSeries(
        ctx,
        engine,
        pane,
        values,
        (v) => v.basis ?? NaN,
        this.color,
        lineWidth,
        priceMin,
        priceMax,
      );

      // Envelope bands
      drawLineSeries(
        ctx,
        engine,
        pane,
        values,
        (v) => v.upper_band ?? NaN,
        COLOR_UPPER,
        lineWidth - 0.5,
        priceMin,
        priceMax,
      );

      drawLineSeries(
        ctx,
        engine,
        pane,
        values,
        (v) => v.lower_band ?? NaN,
        COLOR_LOWER,
        lineWidth - 0.5,
        priceMin,
        priceMax,
      );

      // Trap markers (visible at the bar extreme they were flagged on)
      const start = Math.max(engine.viewStart, 0);
      const end = Math.min(engine.viewEnd, values.length);

      ctx.save();

      for (let i = start; i < end; i++) {
        const v = values[i];

        if (!v) continue;

        if (v.bull_trap) {
          const x = Math.round(engine.utils.xOf(i)) + 0.5;
          const y = engine.utils.yOf(v.low, pane, priceMin, priceMax);

          ctx.beginPath();
          ctx.fillStyle = COLOR_BULL_MARKER;
          ctx.arc(x, y + 5, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (v.bear_trap) {
          const x = Math.round(engine.utils.xOf(i)) + 0.5;
          const y = engine.utils.yOf(v.high, pane, priceMin, priceMax);

          ctx.beginPath();
          ctx.fillStyle = COLOR_BEAR_MARKER;
          ctx.arc(x, y - 5, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.restore();
    },

    // The backend already sends ReversalTrap values, so the incremental
    // update just appends/replaces the incoming point.
    updateIncremental(
      data: readonly ReversalTrapValue[],
      values: ReversalTrapValue[],
      isNewBar: boolean,
    ): void {
      if (isNewBar) {
        values.push(data[data.length - 1]);
      } else {
        values[values.length - 1] = data[data.length - 1];
      }
    },

    tooltipRow(values: ReversalTrapValue[], i: number): any {
      const v = values[i];

      if (!v) return null;

      const fmt = (x: number | null) =>
        x === null ? "-" : x.toFixed(2);

      return {
        label: "RT",
        value: `B:${fmt(v.basis)} U:${fmt(v.upper_band)} L:${fmt(v.lower_band)} RSI:${fmt(v.rsi)}`,
        color: this.color,
      };
    },

    priceTags(
      data: readonly ReversalTrapValue[],
      values: readonly ReversalTrapValue[],
    ): readonly PriceTag[] {
      const last = values.at(-1);

      if (!last || last.basis === null) {
        return [];
      }

      return [
        {
          value: last.basis,
          color: this.priceTagColor!,
          label: "Basis",
        },
      ];
    },

    valueRange(
      data: readonly ReversalTrapValue[],
      values: readonly ReversalTrapValue[],
      start: number,
      end: number,
    ) {
      let lo = Infinity;
      let hi = -Infinity;

      for (let i = start; i < end; i++) {
        const v = values[i];

        if (!v) continue;

        const fields = [v.basis, v.upper_band, v.lower_band];

        for (const value of fields) {
          if (value === null || !Number.isFinite(value)) continue;

          lo = Math.min(lo, value);
          hi = Math.max(hi, value);
        }
      }

      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { lo: 0, hi: 1 };
      }

      return { lo, hi };
    },

    legend(
      data: ReversalTrapValue[],
      values: ReversalTrapValue[],
      barIndex: number,
    ) {
      const d: ReversalTrapValue = data[barIndex];

      if (!d) {
        return [];
      }

      const fmt = (x: number | null) =>
        x === null ? "-" : x.toFixed(2);

      return [
        {
          label: "T",
          value: d.time.toFixed(2),
          color: this.color,
        },
        {
          label: "Basis",
          value: fmt(d.basis),
          color: this.color,
        },
        {
          label: "U",
          value: fmt(d.upper_band),
          color: COLOR_UPPER,
        },
        {
          label: "L",
          value: fmt(d.lower_band),
          color: COLOR_LOWER,
        },
        {
          label: "RSI",
          value: fmt(d.rsi),
          color: "#2962FF",
        },
      ];
    },
  };

  return series;
};