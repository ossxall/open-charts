import { _mergeoptions } from "../utils/_mergeOptions";
import { _loadCssVariables } from "../core/_loadCssVariables";
import { _buildLegend } from "../ui/_buildLegend";
import type { ChartOptions } from "../core/config";
import type { ChartEngine } from "../core/ChartEngine";

/**
 * Applies one or more chart options.
 *
 * Only the properties provided in `newOptions` are updated; all other
 * existing options remain unchanged.
 *
 * @param newOptions Partial chart configuration to apply.
 */
export function _applyOptions(
  engine: ChartEngine,
  newOptions: Partial<ChartOptions>,
) {
  engine.options = _mergeoptions(engine.options, newOptions) as ChartOptions;
  engine.core.loadCssVariables();
  _buildLegend(engine);
  engine.dirty = true;
}
