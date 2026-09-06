import type { ChartEngine } from "../core/ChartEngine";
import { _updateIndicatorLegend } from "../ui/_updateIndicatorLegend";
import {
  ChartSeries,
  type AnyChartSeries,
  type AnySeriesDefinition,
} from "../core/types";

/**
 * Registers a new indicator series.
 *
 * The indicator parameters are cloned to keep each series instance
 * independent from its original definition. If chart data is already
 * available, the indicator values are computed immediately.
 *
 * @param engine Chart engine instance.
 * @param def Indicator definition.
 * @returns The chart instance for method chaining.
 */
export function addSeries<
  TData,
  TValue,
  TParams extends Record<string, unknown>,
>(engine: ChartEngine, def: AnySeriesDefinition): AnyChartSeries {
  // Clone the indicator parameter definitions.
  const params: Record<string, unknown> = {};

  if (def.params) {
    for (const [key, field] of Object.entries(def.params)) {
      params[key] = { ...(field as any) };
    }
  }

  // Create the series instance.
  const entry: AnyChartSeries = new ChartSeries(engine, def, params);

  // Register the series using its unique identifier.
  engine._series.set(def.id, entry);

  // Show the series in the indicator legend right away,
  // even before any history data is available.
  _updateIndicatorLegend(engine, -1);

  // Enable method chaining.
  return entry;
}
