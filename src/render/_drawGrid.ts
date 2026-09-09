import { _nicePriceSteps } from "../utils/_nicePriceSteps";
import { _timeGridStep } from "./_timeGridStep";
import { _isTimeGridLine } from "./_isTimeGridLine";
import type { ChartEngine } from "../core/ChartEngine";
import type { MainPane } from "../core/types";

/**
 * Draws the chart grid.
 *
 * The grid consists of:
 * - Horizontal price levels.
 * - Vertical time divisions.
 *
 * All horizontal lines are batched into a single path, followed by
 * all vertical lines, minimizing Canvas draw calls.
 */
export function _drawGrid(
  engine: ChartEngine,
  ctx: CanvasRenderingContext2D,
  pane: MainPane,
  priceMin: number,
  priceMax: number,
): void {
  const chartW = engine.chartW;
  const chartH = pane.h;

  ctx.save();

  ctx.strokeStyle = engine.options.colors.grid;
  ctx.lineWidth = 1;

  //
  // Horizontal price grid
  //
  const priceSteps = _nicePriceSteps(
    priceMin,
    priceMax,
    Math.max(3, Math.floor(chartH / 80)),
  );

  ctx.beginPath();

  for (const price of priceSteps) {
    const y =
      Math.round(engine.utils.yOf(price, pane, priceMin, priceMax)) + 0.5;

    ctx.moveTo(0, y);
    ctx.lineTo(chartW, y);
  }

  ctx.stroke();

  ctx.beginPath();

  // Vertical time grid.
  if (!engine.hasData) {
    // When there is no data yet there are no bar indices to derive
    // grid positions from, so draw evenly-spaced lines across the
    // full chart width to display the complete grid.
    const target = Math.max(3, Math.floor(chartW / 80));
    const spacing = chartW / target;

    for (let n = 1; n < target; n++) {
      const x = Math.round(n * spacing) + 0.5;

      ctx.moveTo(x, 0);
      ctx.lineTo(x, chartH);
    }
  } else {
    const step = _timeGridStep(engine);

    for (
      let i = engine.viewStart;
      i < engine.viewEnd && i < engine.data.length;
      i++
    ) {
      if (!_isTimeGridLine(engine, i, step)) continue;

      const x = Math.round(engine.utils.xOf(i)) + 0.5;

      ctx.moveTo(x, 0);
      ctx.lineTo(x, chartH);
    }
  }

  ctx.stroke();

  ctx.restore();
}