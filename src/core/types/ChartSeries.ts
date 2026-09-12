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

  /**
   * Active lazy patch stream timer, if any.
   */
  private _patchLazyTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Bars still pending insertion in the active lazy patch stream.
   */
  private _patchLazyPending: TData[] = [];

  /**
   * Number of `_patchLazyPending` bars already inserted.
   */
  private _patchLazyIndex: number = 0;

  /**
   * Bars appended per lazy patch tick.
   */
  private _patchLazyChunk: number = 1;

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

    this.engine.priceViewport.auto = true;

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

    this.engine.priceViewport.auto = true;

    this.engine.priceScale.updateLayout();

    this.engine.timeScale.scrollToRealTime();

    this.engine.dirty = true;

    this.engine.emit({
      type: "series:data",
      seriesId: this.def.id,
      source: "patch",
      series: this,
    });
  }

  /**
   * Patches series data lazily over time.
   *
   * The incoming data is appended in chunks so the chart visibly replays
   * the bars instead of being filled in a single frame. By default a
   * single bar is appended per interval tick, producing a smooth
   * one-bar-at-a-time animation.
   *
   * While a stream is in flight, further calls do NOT restart it: the
   * new bars are merged into the remaining queue so the animation
   * continues normally. The series time-deduplicates the incoming data,
   * so re-patching a superset (as the backtesting loop does) is safe.
   *
   * @param data - Incoming data to patch incrementally.
   * @param intervalMs - Delay between bars, in milliseconds. Defaults to 100.
   * @param chunkSize - Bars appended per tick. Defaults to 1.
   * @returns A cancel function that stops the pending stream.
   */
  public patchDataLazy(
    data: readonly TData[],
    intervalMs = 100,
    chunkSize = 1,
  ): () => void {
    if (!data || data.length === 0) {
      return () => this._stopPatchLazy();
    }

    const existingTimes = new Set(this.data.map((d) => d.time));

    for (let i = this._patchLazyIndex; i < this._patchLazyPending.length; i++) {
      existingTimes.add(this._patchLazyPending[i].time);
    }

    const fresh = data.filter((d) => !existingTimes.has(d.time));

    if (fresh.length === 0) {
      return () => {};
    }

    this._patchLazyChunk = Math.max(1, chunkSize);

    if (this._patchLazyTimer != null) {
      // A stream is already in flight: append the new bars to the end
      // of the queue and let the animation continue smoothly. No
      // compaction is done here — the consume index already advanced
      // past the applied bars, so this is O(fresh) instead of O(queue).
      this._patchLazyPending.push(...fresh);

      return () => this._stopPatchLazy();
    }

    this._patchLazyPending = fresh;

    this._patchLazyIndex = 0;

    const step = () => {
      const remaining = this._patchLazyPending.length - this._patchLazyIndex;

      if (remaining <= 0) {
        this._stopPatchLazy();
        return;
      }

      const slice = this._patchLazyPending.slice(
        this._patchLazyIndex,
        this._patchLazyIndex + this._patchLazyChunk,
      );

      this._patchLazyIndex += slice.length;

      this.data.push(...slice);

      if (
        slice.length === 1 &&
        (this.values as unknown) !== (this.data as unknown) &&
        this.def.updateIncremental
      ) {
        // Incremental path: O(period) instead of O(n) per animation tick.
        // Never used when `values` aliases `data` (e.g. Candlestick's
        // compute returns the input array): pushing data[last] onto the
        // same array would duplicate bars.
        this.def.updateIncremental(this.data, this.values, true, this.params);
      } else {
        this.values = this.def.compute(this.data, this.params);
      }

      this.engine.hasData = true;

      this.interval = this.getInterval();

      this.engine.priceViewport.auto = true;

      this.engine.priceScale.updateLayout();

      this.engine.timeScale.scrollToRealTime();

      this.engine.dirty = true;

      this.engine.emit({
        type: "series:data",
        seriesId: this.def.id,
        source: "patch",
        series: this,
      });
    };

    step();

    this._patchLazyTimer = setInterval(step, intervalMs);

    return () => this._stopPatchLazy();
  }

  /**
   * Cancels any lazily streamed patch currently in flight.
   */
  private _stopPatchLazy(): void {
    if (this._patchLazyTimer != null) {
      clearInterval(this._patchLazyTimer);

      this._patchLazyTimer = null;
    }

    this._patchLazyPending = [];

    this._patchLazyIndex = 0;
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

    this.engine.priceViewport.auto = true;

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
  public destroy(options?: { silent?: boolean }): void {
    // Idempotent: only the first call removes the series and emits the event.
    if (!this.engine._series.has(this.def.id)) {
      return;
    }

    this.engine._series.delete(this.def.id);
    this.engine.dirty = true;
    this.engine.hasData = false;

    this._stopPatchLazy();

    if (options?.silent) {
      return;
    }

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
