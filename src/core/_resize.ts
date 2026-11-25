import type { ChartEngine } from "./ChartEngine";
import { _updateScrollThumb } from "../timeScale/_updateScrollThumb";
import { _buildLegend } from "../ui/_buildLegend";

/**
 * Resizes a canvas to match its container while preserving
 * sharp rendering on high-DPI displays.
 *
 * The canvas backing-store is resized using the device pixel ratio (DPR),
 * while the CSS size remains expressed in logical pixels. The rendering
 * context is then reset and scaled so all drawing operations continue to
 * use CSS pixel coordinates transparently.
 *
 * @param canvas Canvas element to resize.
 * @param container Container whose dimensions define the canvas size.
 * @param dpr Device pixel ratio used to scale the backing-store.
 */
function _resizeCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  dpr: number,
): void {
  // Read the current container size.
  const rect: DOMRect = container.getBoundingClientRect();

  // Compute the canvas backing-store size in physical pixels.
  const width = Math.ceil(rect.width * dpr);
  const height = Math.ceil(rect.height * dpr);

  // Resize the canvas backing-store. (Internal buffer physical pixels)
  canvas.width = width;
  canvas.height = height;

  // Preserve the displayed size in CSS pixels. (CSS visual pixels)
  canvas.style.width = `${width / dpr}px`;
  canvas.style.height = `${height / dpr}px`;

  // Reset any previous transform before applying the DPR scale.
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  // Scale the drawing context so rendering code can continue
  // using logical (CSS) pixel coordinates.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

/**
 * Resizes the price scale canvas while preserving crisp rendering
 * on high-DPI displays.
 *
 * Unlike the main chart canvas, the price scale has a fixed logical width
 * defined by the chart options, while its height follows the chart layout.
 * The backing-store is resized using the device pixel ratio (DPR), then the
 * rendering context is reset and scaled so all drawing operations continue
 * to use logical (CSS) pixel coordinates.
 *
 * @param engine Chart engine instance.
 * @param height Price scale height in CSS pixels.
 * @param dpr Device pixel ratio used to scale the backing-store.
 */
function _resizePriceScale(
  engine: ChartEngine,
  height: number,
  dpr: number,
): void {
  // Compute the backing-store dimensions in physical pixels.
  const width: number = Math.ceil(engine.options.priceScaleWidth * dpr);
  const scaledHeight: number = Math.ceil(height * dpr);

  // Resize the canvas backing-store.
  engine.pScale.width = width;
  engine.pScale.height = scaledHeight;

  // Preserve the displayed size in CSS pixels.
  engine.pScale.style.width = `${width / dpr}px`;
  engine.pScale.style.height = `${scaledHeight / dpr}px`;

  // Reset any previous transform before applying the DPR scale.
  engine.ctxPScale.setTransform(1, 0, 0, 1, 0, 0);

  // Scale the drawing context so rendering code can continue
  // using logical (CSS) pixel coordinates.
  engine.ctxPScale.scale(dpr, dpr);
}

/**
 * Recomputes the chart layout after the container size changes.
 *
 * This function synchronizes every rendering surface with the current
 * layout, updates pane geometry, recalculates the drawable chart width,
 * validates the viewport, and schedules a full redraw.
 *
 * This function should be called whenever:
 *
 * - The window is resized.
 * - The chart container changes size.
 * - The device pixel ratio changes.
 *
 * @param engine Chart engine.
 */
export function _resize(engine: ChartEngine): void {
  const mainRect: DOMRect = engine.paneMainEl.getBoundingClientRect();
  if (mainRect.width <= 0 || mainRect.height <= 0) {
    return;
  }

  // Current device pixel ratio.
  const dpr: number = window.devicePixelRatio || 1;

  // Resize every canvas that follows the main pane.
  _resizeCanvas(engine.cMain, engine.paneMainEl, dpr);
  _resizeCanvas(engine.oMain, engine.paneMainEl, dpr);
  _resizeCanvas(engine.cDrawings, engine.paneMainEl, dpr);

  // Resize the bottom time axis.
  _resizeCanvas(engine.cTime, engine.timeAxisEl, dpr);

  // Read the updated layout.
  const timeRect: DOMRect = engine.timeAxisEl.getBoundingClientRect();

  // Resize the fixed-width price scale.
  _resizePriceScale(engine, mainRect.height, dpr);

  // Recalculate the drawable chart width.
  engine.chartW = mainRect.width - engine.options.priceScaleWidth;

  // Update the main pane geometry.
  engine.panes.main = {
    x: mainRect.left,
    y: mainRect.top,
    w: mainRect.width,
    h: mainRect.height,
    canvas: engine.cMain,
    ctx: engine.ctxMain,
    oCtx: engine.ctxOMain,
  };

  // Update the price scale geometry.
  engine.panes.scale = {
    x: engine.chartW,
    y: 0,
    w: engine.options.priceScaleWidth,
    h: mainRect.height,
  };

  // Update the time axis geometry.
  engine.panes.time = {
    x: timeRect.left,
    y: timeRect.top,
    w: timeRect.width,
    h: timeRect.height,
  };

  // Keep the current viewport valid after the resize.
  engine.timeScale.clampView();

  // Synchronize the scrollbar with the new viewport.
  engine.timeScale.updateScrollThumb();

  // Build chart legend
  _buildLegend(engine);

  // Schedule a full redraw.
  engine.dirty = true;
  engine.overlayDirty = true;
}
