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
  updateIncremental?(
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

    this.values = this.def.compute(this.data, this.params);

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
      const pending = this._patchLazyPending[i];
      if (pending) {
        existingTimes.add(pending.time);
      }
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

  /**
   * Inserts or replaces a bar. Kept as the short-form live-update API.
   *
   * @param bar Incoming bar.
   * @returns Whether the series was changed.
   */
  public update(bar: TData): boolean {
    if (!bar || !Number.isFinite(bar.time)) {
      return false;
    }

    const latest = this.data.at(-1);
    if (latest && bar.time < latest.time) {
      return false;
    }

    return this.upsert(bar);
  }

  /**
   * Inserts or replaces a bar while keeping the series ordered by time.
   *
   * Appending a bar or revising the latest bar uses the definition's
   * `updateIncremental` hook when available. Older corrections and insertions
   * fall back to a full compute so dependent values remain correct.
   *
   * @param bar Incoming bar.
   * @param options Optional bound for the retained data window.
   * @returns Whether the series was changed.
   */
  public upsert(
    bar: TData,
    options: { maxDataPoints?: number } = {},
  ): boolean {
    if (!bar || !Number.isFinite(bar.time)) return false;

    const maxDataPoints = options.maxDataPoints;
    if (
      maxDataPoints !== undefined
      && (!Number.isInteger(maxDataPoints) || maxDataPoints < 1)
    ) {
      throw new RangeError("maxDataPoints must be a positive integer");
    }

    const maxPoints = maxDataPoints === undefined
      ? undefined
      : Math.floor(maxDataPoints);
    const oldLength = this.data.length;
    const oldViewStart = this.engine.viewStart;
    const oldViewEnd = this.engine.viewEnd;
    const wasAtLiveEdge = oldLength === 0 || oldViewEnd >= oldLength;
    const valuesAliasData =
      (this.values as unknown) === (this.data as unknown);

    // Find the first bar whose time is not less than the incoming time.
    let low = 0;
    let high = oldLength;
    while (low < high) {
      const mid = low + Math.floor((high - low) / 2);
      if (this.data[mid]!.time < bar.time) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const index = low;
    const exists = index < oldLength && this.data[index]!.time === bar.time;
    const isAppend = index === oldLength;
    const isLatestReplacement = exists && index === oldLength - 1;

    if (exists) {
      this.data[index] = bar;
    } else {
      this.data.splice(index, 0, bar);
    }

    const canUpdateIncrementally = isAppend || isLatestReplacement;
    if (canUpdateIncrementally) {
      // Some series return the source data itself from compute(). Mutating
      // `data` already updates `values` in that case; calling the hook would
      // append the same point twice.
      if (!valuesAliasData) {
        if (this.def.updateIncremental) {
          this.def.updateIncremental(
            this.data,
            this.values,
            isAppend,
            this.params,
          );
        } else {
          this.values = this.def.compute(this.data, this.params);
        }
      }
    } else {
      // A correction before the latest point can affect every subsequent
      // indicator value, so use the definition's canonical full computation.
      this.values = this.def.compute(this.data, this.params);
    }

    let trimmed = 0;
    if (maxPoints !== undefined && this.data.length > maxPoints) {
      trimmed = this.data.length - maxPoints;
      this.data.splice(0, trimmed);
      if (!valuesAliasData) {
        this.values.splice(0, trimmed);
      }
    }

    this.engine.hasData = this.data.length > 0;

    if (!this.engine.hasData) return false;

    if ((!this.interval || !canUpdateIncrementally) && this.data.length >= 2) {
      this.interval = this.getInterval();
    }

    if (oldLength === 0) {
      this.engine.priceViewport.auto = true;
      this.engine.timeScale.resetViewport();
    } else if (wasAtLiveEdge && (isAppend || !exists)) {
      this.engine.timeScale.scrollToRealTime();
    } else {
      // Keep the same logical bars in view when an older bar is inserted or
      // the bounded data window drops points from its front.
      const insertedBeforeView = !exists && index < oldViewStart;
      const adjustedStart = oldViewStart + (insertedBeforeView ? 1 : 0);
      const adjustedEnd = oldViewEnd + (insertedBeforeView ? 1 : 0);
      if (adjustedStart >= trimmed) {
        this.engine.viewStart = adjustedStart - trimmed;
        this.engine.viewEnd = Math.max(
          this.engine.viewStart,
          adjustedEnd - trimmed,
        );
      } else {
        this.engine.viewStart = 0;
        this.engine.viewEnd = Math.max(0, adjustedEnd - adjustedStart);
      }
    }

    this.engine.priceScale.updateLayout();

    if (this.data.length !== oldLength) {
      this.engine.timeScale.updateScrollThumb();
    }
    if (!exists) {
      this.engine.timeAxisDirty = true;
    }

    this.engine.dirty = true;
    this.engine.overlayDirty = true;

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
