import type { ChartEngine } from "../../core/ChartEngine";
import type { ChartOptions } from "../../core/config";
import type { AnyChartSeries, AnySeriesDefinition } from "../../core/types";
import { _applyOptions } from "../_applyOptions";
import { _destroy } from "../_detroy";
import { addSeries } from "../addSeries";

/**
 * Public API exposed by the chart engine.
 */
export class ChartApi {
  constructor(private readonly engine: ChartEngine) {}

  /**
   * Creates and registers a new chart series.
   *
   * The series is instantiated from the provided series definition and added
   * to the chart. Each registered series maintains its own data, computed
   * values, and parameter state independently of the original definition.
   *
   * @param def The series definition describing how the series computes and renders.
   * @returns The created series instance.
   */
  public addSeries(def: AnySeriesDefinition): AnyChartSeries {
    return addSeries(this.engine, def);
  }

  /**
   * Applies one or more chart options.
   *
   * Only the properties provided in `newOptions` are updated; all other
   * existing options remain unchanged.
   *
   * @param newOptions Partial chart configuration to apply.
   */
  public applyOptions(newOptions: Partial<ChartOptions>) {
    _applyOptions(this.engine, newOptions);
  }

  public destroy() {
    _destroy(this.engine);
  }
}
