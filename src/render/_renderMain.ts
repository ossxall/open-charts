import type { ChartEngine } from "../core/ChartEngine";
import type { MainPane } from "../core/types";
import { _drawGrid } from "./_drawGrid";

/**
 * Renders all series belonging to a specific rendering layer.
 *
 * @param engine Chart engine instance.
 * @param ctx Target rendering context.
 * @param pane Main chart pane.
 * @param priceMin Lowest visible price.
 * @param priceMax Highest visible price.
 * @param background Whether to render the background layer.
 */
function _renderLayer(
  engine: ChartEngine,
  ctx: CanvasRenderingContext2D,
  pane: MainPane,
  priceMin: number,
  priceMax: number,
  layer: "background" | "foreground",
): void {
  engine._series.forEach(({ def, data, values, params, enabled }) => {
    if (!enabled) return;

    if (def.layer !== layer) return;

    ctx.save();

    def.render(ctx, pane, engine, data, values, params, priceMin, priceMax);

    ctx.restore();
  });
}

/**
 * Fills the main chart pane with the configured background color.
 *
 * This clears the previous frame visually by painting a solid
 * background over the entire pane.
 *
 * @param engine Chart engine instance.
 * @param ctx Target rendering context.
 * @param pane Main chart pane.
 */
export function _drawBackground(
  engine: ChartEngine,
  ctx: CanvasRenderingContext2D,
  pane: MainPane,
): void {
  // Set the configured chart background color.
  ctx.fillStyle = engine.options.colors.bg;

  // Paint the entire pane.
  ctx.fillRect(0, 0, pane.w, pane.h);
}

/**
 * Renders the main chart pane.
 *
 * Rendering order:
 * 1. Background
 * 2. Grid
 * 3. Background series
 * 4. Foreground series
 *
 * @param engine Chart engine instance.
 * @param priceMin Lowest visible price.
 * @param priceMax Highest visible price.
 */
export function _renderMain(
  engine: ChartEngine,
  priceMin: number,
  priceMax: number,
): void {
  const pane = engine.panes.main;
  const ctx = pane.ctx;

  // Clear the previous frame.
  ctx.clearRect(0, 0, pane.w, pane.h);

  // Paint the chart background.
  _drawBackground(engine, ctx, pane);

  // Draw the grid.
  _drawGrid(engine, ctx, pane, priceMin, priceMax);

  // Render background series.
  _renderLayer(engine, ctx, pane, priceMin, priceMax, "background");

  // Render foreground series.
  _renderLayer(engine, ctx, pane, priceMin, priceMax, "foreground");
}
