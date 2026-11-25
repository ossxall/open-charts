// OPEN-CHARTS
// Copyright (C) 2026 Juan José Caballero Rey - https://github.com/rey-sudo
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

import { _bindEvents } from "../_bindEvents";
import { _buildLayout } from "../_buildLayout";
import { _grabCanvases } from "../_grabCanvases";
import { _loadCssVariables } from "../_loadCssVariables";
import { _resize } from "../_resize";
import { _startLoop } from "../_startLoop";
import { _visiblePriceRange, type PriceRange } from "../_visiblePriceRange";
import type { ChartEngine } from "../ChartEngine";

/** Internal engine operations and lifecycle methods. */
export class ChartCore {
  constructor(private readonly engine: ChartEngine) {}

  /**
   * Applies configured values as CSS custom properties
   * on the document root element.
   */
  public loadCssVariables(): void {
    _loadCssVariables(this.engine);
  }

  /**
   * Builds and injects the chart DOM structure into the container.
   *
   * The layout includes:
   * - Main chart pane and rendering canvases
   * - Time axis
   * - Horizontal scrollbar
   * - Legend and indicators containers
   * - Debug/status bar
   */
  public buildLayout(): void {
    _buildLayout(this.engine);
  }

  /**
   * Retrieves all chart DOM elements and initializes their
   * corresponding 2D rendering contexts.
   */
  public grabCanvases(): void {
    _grabCanvases(this.engine);
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
   */
  public resize(): void {
    _resize(this.engine);
  }

  /**
   * Registers all user interaction and lifecycle event handlers
   * required by the chart, including mouse, touch, scrolling,
   * zooming, panning, scrollbar dragging, and window resizing.
   */
  public bindEvents(): void {
    _bindEvents(this.engine);
  }

  /**
   * Starts the chart render loop.
   *
   * The loop runs continuously using `requestAnimationFrame` and
   * redraws only the layers that have been marked as dirty.
   *
   * Rendering is split into independent passes:
   * - Main chart
   * - Drawings
   * - Overlay
   */
  public startLoop(): void {
    _startLoop(this.engine);
  }

  /**
   * Pauses rendering without discarding chart data or dirty state.
   * Call startLoop() after resizing the chart when it becomes visible again.
   */
  public pauseLoop(): void {
    this.engine._running = false;

    if (this.engine._rafId) {
      cancelAnimationFrame(this.engine._rafId);
      this.engine._rafId = 0;
    }
  }

  public visiblePriceRange(): PriceRange {
    return _visiblePriceRange(this.engine);
  }
}
