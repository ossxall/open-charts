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

import type { PriceRange } from "../_visiblePriceRange";
import type { ChartEngine } from "../ChartEngine";
import type { MainPane } from "./ChartPanes";
import type { LegendItem } from "./LegendItem";
import type { PriceTag } from "./PriceTag";
import {
  _isParamDescriptor,
  _resolveParamValue,
  type ParamDescriptor,
} from "../../utils/_paramValue";

export interface TimePoint {
  time: number;
}

export type AnySeriesDefinition = SeriesDefinition<
  TimePoint,
  unknown,
  unknown,
  unknown
>;

export interface SeriesDefinition<
  TData extends TimePoint,
  TValue,
  TParams = Record<string, unknown>,
  TTooltip = unknown,
> {
  /** Unique series identifier. */
  id: string;

  /** Display label. */
  label: string;

  /** Default series color. */
  color: string;

  /** Rendering layer. */
  layer: "background" | "foreground";

  /** Optional price tag color. */
  priceTagColor?: string;
 
  width: string,

  height: string,

  /** Series parameters. */
  params: TParams;

  /** Computes indicator values from the source data and the current instance params. */
  compute(data: readonly TData[], params: TParams): TValue[];

  /** Renders the series. */
  render(
    ctx: CanvasRenderingContext2D,
    pane: MainPane,
    engine: ChartEngine,
    data: readonly TData[],
    values: readonly TValue[],
    params: TParams,
    priceMin: number,
    priceMax: number,
  ): void;

  /** Updates the cached values incrementally. */
  updateIncremental(
    data: readonly TData[],
    values: TValue[],
    isNewBar: boolean,
    params: TParams,
  ): void;

  /** Returns a tooltip row for the given index. */
  tooltipRow(values: readonly TValue[], index: number): TTooltip | null;

  priceTags(
    data: readonly TData[],
    values: readonly TValue[],
  ): readonly PriceTag[];

  /**
   * Returns the visible value range used to scale the chart.
   * If omitted, the engine falls back to the default OHLC range.
   */
  valueRange(
    data: readonly TData[],
    values: readonly TValue[],
    start: number,
    end: number,
    params: TParams,
  ): PriceRange;

  legend(
    data: readonly TData[],
    values: readonly TValue[],
    index: number,
    params: TParams,
  ): readonly LegendItem[];
}

export type AnyChartSeries = ChartSeries<any, any, any>;

/**
 * Represents a chart series.
 *
 * A series owns its data, computed values, parameters,
 * and exposes the public API used by consumers.
 */
export class ChartSeries<
  TData extends TimePoint,
  TValue,
  TParams = Record<string, unknown>,
> {
  /** Indicator definition. */
  public readonly def: SeriesDefinition<TData, TValue, TParams>;

  /** Source data for the series. */
  public data: TData[] = [];

  /** Computed values used for rendering. */

  public values: TValue[] = [];

  /** Whether the series is currently visible. */
  public enabled: boolean = true;

  public interval: number = 0;

  /** User-defined series parameters. */
  public params: TParams;

  constructor(
    private readonly engine: ChartEngine,
    def: SeriesDefinition<TData, TValue, TParams>,
    params: TParams,
  ) {
    this.def = def;
    this.params = params;
  }

  /**
   * Returns the interval between consecutive bars in seconds.
   *
   * The interval is inferred from the primary series data.
   * If there are fewer than two bars, zero is returned.
   *
   * @returns Bar interval in seconds.
   */
  public getInterval(): number {
    const data: any[] = this.data;

    for (let i = 1; i < data.length; i++) {
      const interval = data[i].time - data[i - 1].time;

      if (interval > 0) {
        return interval;
      }
    }

    return 0;
  }

  /**
   * Replaces the series data.
   *
   * @param data New data set.
   * @returns The series instance.
   */
  public setData(data: readonly TData[]): void {
    if(!data) return;
    
    if (data.length === 0) {
      return;
    }

    this.data = [...data];

    this.values = this.def.compute(data, this.params);

    this.engine.hasData = data.length > 0;

    if (!this.engine.hasData) return;

    this.interval = this.getInterval();

    this.engine.timeScale.resetViewport();

    this.engine.priceScale.updateLayout();

    this.engine.timeScale.scrollToRealTime();

    this.engine.dirty = true;

    this.engine.emit({
      type: "series:data",
      seriesId: this.def.id,
      source: "set",
      series: this,
    });
  }

  public patchData(data: readonly TData[]): void {
    if(!data) return;

    if (data.length === 0) {
      return;
    }

    const existingTimes = new Set(this.data.map((d) => d.time));

    const newData = data.filter((d) => !existingTimes.has(d.time));

    if (newData.length === 0) {
      return;
    }

    this.data = [...this.data, ...newData];

    this.values = this.def.compute(this.data, this.params);

    this.engine.hasData = true;

    this.interval = this.getInterval();

    this.engine.priceScale.updateLayout();

    this.engine.dirty = true;

    this.engine.emit({
      type: "series:data",
      seriesId: this.def.id,
      source: "patch",
      series: this,
    });
  }

  public update(bar: TData): boolean {
    if (!bar) return false;

    let isNewBar = false;

    if (this.data.length === 0) {
      this.data.push(bar);
    } else {
      const last = this.data[this.data.length - 1];

      if (bar.time < last.time) {
        return false;
      }

      isNewBar = bar.time > last.time;

      if (isNewBar) {
        this.data.push(bar);
      } else {
        this.data[this.data.length - 1] = bar;
      }
    }

    this.values = this.def.compute(this.data, this.params);

    this.engine.hasData = this.data.length > 0;

    if (!this.engine.hasData) return false;

    if (!this.interval && this.data.length >= 2) {
      this.interval = this.getInterval();
    }

    this.engine.timeScale.resetViewport();
    this.engine.priceScale.updateLayout();

    this.engine.dirty = true;

    this.engine.emit({
      type: "series:data",
      seriesId: this.def.id,
      source: "update",
      series: this,
    });

    return true;
  }

  /**
   * 
   * Enables or disables the series.
   *
   * @param visible Whether the series should be rendered.
   * @returns The series instance.
   * 
   */
  public setVisible(visible: boolean): this {
    const changed = this.enabled !== visible;

    this.enabled = visible;
    this.engine.dirty = true;

    if (changed) {
      this.engine.emit({
        type: "series:visibility",
        seriesId: this.def.id,
        visible,
        series: this,
      });
    }

    return this;
  }

  /**
   * 
   * Removes the series from the chart.
   * 
   */
  public destroy(): void {
    // Idempotent: only the first call removes the series and emits the event.
    if (!this.engine._series.has(this.def.id)) {
      return;
    }

    this.engine._series.delete(this.def.id);
    this.engine.dirty = true;
    this.engine.hasData = false;

    this.engine.emit({
      type: "series:removed",
      seriesId: this.def.id,
      series: this,
    });
  }

  /**
   *
   * Updates series parameters.
   *
   * Only keys that already exist in the series' `params` are updated (unknown
   * keys are ignored). Values may be plain or descriptor objects
   * (`{ value }`); descriptors preserve their metadata and only replace
   * their `value`. When an updated descriptor has `affectsCompute` set,
   * `values` are recomputed with the series data and the new params, and
   * the price scale layout is refreshed.
   *
   * @param patch - Partial map of parameter values to update.
   * @returns The series instance.
   *
   */
  public setParams(patch: Partial<TParams>): this {
    const params = this.params as Record<string, unknown>;
    let changed = false;
    let needsRecompute = false;

    for (const [key, raw] of Object.entries(patch)) {
      const current = params[key];

      if (current === undefined) continue;

      const next = _resolveParamValue(raw);
      const isDescriptor = _isParamDescriptor(current);

      params[key] = isDescriptor
        ? { ...(current as ParamDescriptor), value: next }
        : next;

      if (isDescriptor && (current as ParamDescriptor).affectsCompute) {
        needsRecompute = true;
      }

      changed = true;
    }

    if (!changed) {
      return this;
    }

    if (needsRecompute) {
      this.values = this.def.compute(this.data, this.params);
      this.engine.priceScale.updateLayout();
    }

    this.engine.dirty = true;

    const affectsCompute: Record<string, boolean> = {};

    for (const [key, field] of Object.entries(
      this.params as Record<string, unknown>,
    )) {
      affectsCompute[key] =
        _isParamDescriptor(field) &&
        (field as ParamDescriptor).affectsCompute === true;
    }

    this.engine.emit({
      type: "series:params",
      seriesId: this.def.id,
      params: this.getParams(),
      affectsCompute,
      series: this,
    });

    return this;
  }

  /**
   * 
   * Returns the current parameter values as a plain map.
   * Descriptor objects are unwrapped so only their effective `value`
   * is returned.
   * 
   */
  public getParams(): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(
      this.params as Record<string, unknown>,
    )) {
      out[key] = _isParamDescriptor(field)
        ? (field as { value: unknown }).value
        : field;
    }

    return out;
  }
}
