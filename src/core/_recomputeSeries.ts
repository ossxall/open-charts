import type { ChartEngine } from "./ChartEngine";
import type { AnyChartSeries } from "./types";

// Recompute values for all registered series (called on full load)
export function _recomputeSeries(engine: ChartEngine) {
  engine._series.forEach((entry: AnyChartSeries) => {
    entry.values = entry.def.compute(engine.data, entry.params);
  });
}
