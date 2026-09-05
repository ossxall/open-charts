import { _visiblePriceRange } from "../core/_visiblePriceRange";
import { _renderMain } from "../render/_renderMain";
import { _renderPriceScale } from "../render/_renderPriceScale";
import { _renderTimeAxis } from "../render/_renderTimeAxis";
import { _renderOverlay } from "../render/_renderOverlay";
import type { ChartEngine } from "./ChartEngine";
import { _renderDrawingModules } from "../render/_renderDrawingModules";

/**
 * Starts the chart render loop.
 *
 * The engine uses a dirty-flag based renderer to avoid unnecessary work.
 * Each layer is rendered only when its corresponding dirty flag is set.
 *
 * Render order:
 * 1. Main chart (candles, series, etc.)
 * 2. Drawing modules
 * 3. Time axis
 * 4. Overlay (crosshair, tags, live pulse, etc.)
 *
 * The loop runs continuously using `requestAnimationFrame`, but only
 * repaints layers whose state has changed.
 *
 * @param engine Chart engine instance.
 */
export function _startLoop(engine: ChartEngine): void {
  // Enable the render loop.
  engine._running = true;

  const loop = (): void => {
    // Stop scheduling new frames once the engine is no longer running.
    if (!engine._running) return;

    // Schedule the next animation frame.
    engine._rafId = requestAnimationFrame(loop);

    // Redraw the main chart when its state has changed.
    // The chart skeleton (background, grid and price scale) is always
    // rendered, even before any historical data is available.
    if (engine.dirty) {
      const { lo, hi } = _visiblePriceRange(engine);

      _renderMain(engine, lo, hi);
      _renderPriceScale(engine, lo, hi);

      engine.dirty = false;

      // Dependent layers must be refreshed after the main chart.
      engine.drawingsDirty = true;
      engine.timeAxisDirty = true;
      engine.overlayDirty = true;
    }

    // Redraw the drawings layer if needed.
    if (engine.drawingsDirty) {
      _renderDrawingModules(engine);

      engine.drawingsDirty = false;
    }

    // Redraw the time axis if needed.
    if (engine.timeAxisDirty) {
      _renderTimeAxis(engine);

      engine.timeAxisDirty = false;
    }

    // Redraw the overlay layer if needed.
    if (engine.overlayDirty) {
      _renderOverlay(engine);

      engine.overlayDirty = false;
    }
  };

  engine._rafId = requestAnimationFrame(loop);
}
