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

import {
  DEFAULT_OPTIONS,
  DEFAULT_BAR_W,
  type ChartOptions,
} from "./config";
import { _nicePriceSteps } from "../utils/_nicePriceSteps";
import { _formatDate, _formatDateFull } from "../utils/time";
import { _loadCssVariables } from "./_loadCssVariables";
import { _resize } from "./_resize";
import { _bindEvents } from "./_bindEvents";
import { _startLoop } from "./_startLoop";
import { _updateScrollThumb } from "../timeScale/_updateScrollThumb";
import { _visiblePriceRange } from "./_visiblePriceRange";
import { _renderPriceScale } from "../render/_renderPriceScale";
import { _renderTimeAxis } from "../render/_renderTimeAxis";
import { _timeGridStep } from "../render/_timeGridStep";
import { _isTimeGridLine } from "../render/_isTimeGridLine";
import { _xOf } from "../utils/_xOf";
import { _yOf } from "../utils/_yOf";
import { _indexAtX } from "../utils/_indexAtX";
import { _recomputeSeries } from "./_recomputeSeries";
import { _isDifferentBar } from "../utils/_isDifferentBar";
import { _updateSeriesIncremental } from "./_updateSeriesIncremental";
import { ChartApi } from "../api/types";
import {
  ChartCore,
  ChartEventBus,
  DragMode,
  HoverArea,
  type AnyChartSeries,
  type ChartEvent,
  type ChartEventListener,
  type ChartPanes,
  type MouseState,
  type PanOrigin,
  type PriceViewport,
} from "./types";
import { ChartUtils } from "../utils/types";
import { ChartTimeScale } from "../timeScale/types";
import { ChartPriceScale } from "../priceScale/types";

//--------------------------------------------------------------------------------------------------------------------
//  CHART ENGINE
//--------------------------------------------------------------------------------------------------------------------

export class ChartEngine {
  /** Chart configuration options. */
  public options: ChartOptions;

  /** Internal engine operations and lifecycle methods. */
  public core: ChartCore;

  /** Shared utility helpers used by the engine. */
  public utils: ChartUtils;

  /** Public API exposed to library consumers. */
  public api: ChartApi;

  /** Horizontal time scale and viewport management. */
  public timeScale: ChartTimeScale;

  public priceScale: ChartPriceScale;

  /** Root HTML element that hosts the chart. */
  public area: HTMLElement;

  public hoverArea: HoverArea;

  public dragMode: DragMode;

  /** Indicates whether the chart currently contains any data. */
  public hasData: boolean;

  /**
   * Series registry — populated via addSeries()
   * Map<id, { def, values, enabled }>
   */
  public _series: Map<string, AnyChartSeries>;

  /**
   * Indicates whether the process is currently running.
   */
  public _running: boolean;

  /**
   *  Stores the current requestAnimationFrame ID.
   */
  public _rafId: number;

  /**
   * Sets the initial width, in pixels, used to render each chart bar.
   */
  public barWidth: number;

  /**
   * Number of empty bar slots reserved to the right of the last data point.
   */
  public rightPadBars: number;

  /**
   * Index of the first bar currently visible in the viewport.
   */
  public viewStart: number;

  /**
   * Exclusive end index of the current visible range. May exceed
   * data.length due to reserved right-side padding bars.
   */
  public viewEnd: number;

  /**
   * Indicates whether the chart needs to be redrawn.
   *
   * When `true`, the render loop will update the visible frame.
   */
  public dirty: boolean;

  public timeAxisDirty: boolean;

  /**
   * Indicates whether the overlay layer needs to be redrawn.
   *
   * Used for transient elements such as the crosshair, cursor,
   * selection, or drawing previews without repainting the main chart.
   */
  public overlayDirty: boolean;

  /**
   * Stores the latest mouse coordinates and hover state,
   * used by overlay elements.
   */
  public mouse: MouseState;

  /**
   * Stores the pointer position and viewport state at the start
   * of a pan operation, used to calculate drag offsets.
   */
  public panOrigin: PanOrigin;

  /**
   * Defines the visible price range for the chart.
   * When `auto` is true, the viewport is calculated automatically.
   * Otherwise, the range is constrained by `min` and `max`.
   */
  public priceViewport: PriceViewport;

  /**
   * Whether the viewport automatically follows the latest bar.
   */
  public _liveMode: boolean;

  /**
   * Registered drawing tool modules.
   */
  public _drawingModules: any;

  /**
   * Indicates whether pointer input is currently owned by another interaction.
   */
  public _pointerClaimed: boolean;

  /**
   * Indicates whether the drawings layer needs to be redrawn.
   */
  public drawingsDirty: boolean;

  public _dmEventHandlers: any;

  /**
   * Collection of chart panes and their layout information.
   */
  public panes: ChartPanes;

  /**
   * Stores the drawable chart width, excluding the price scale area.
   */
  public chartW: number;

  /**
   * Shared abort controller used to unregister all event listeners
   * and cancel asynchronous operations during cleanup.
   */
  public _abortController: AbortController;

  /**
   * Floating UI containers.
   */
  public legendDiv!: HTMLElement;

  /**
   * Floating UI containers.
   */
  public indicatorsDiv!: HTMLElement;

  /**
   * Main chart rendering canvas.
   */
  public cMain!: HTMLCanvasElement;

  /**
   * Main chart rendering context.
   */
  public ctxMain!: CanvasRenderingContext2D;

  /**
   * Drawings layer canvas.
   */
  public cDrawings!: HTMLCanvasElement;

  /**
   * Drawings layer rendering context.
   */
  public ctxDrawings!: CanvasRenderingContext2D;

  /**
   * Price scale canvas.
   */
  public pScale!: HTMLCanvasElement;

  /**
   * Price scale rendering context.
   */
  public ctxPScale!: CanvasRenderingContext2D;

  /**
   * Overlay canvas.
   */
  public oMain!: HTMLCanvasElement;

  /**
   * Overlay rendering context.
   */
  public ctxOMain!: CanvasRenderingContext2D;

  /**
   * Time axis canvas.
   */
  public cTime!: HTMLCanvasElement;

  /**
   * Time axis rendering context.
   */
  public ctxTime!: CanvasRenderingContext2D;

  /**
   * Main chart pane element.
   */
  public paneMainEl!: HTMLElement;

  /**
   * Time axis container element.
   */
  public timeAxisEl!: HTMLElement;

  /**
   * Horizontal scrollbar element.
   */
  public scrollbarEl!: HTMLElement;

  /**
   * Scrollbar thumb element.
   */
  public scrollThumbEl!: HTMLElement;

  public crosshairPlusButton!: HTMLElement;

  /**
   * Global event bus.
   *
   * All chart events — including events originating from any series —
   * are dispatched through this bus to every subscriber.
   */
  public _eventBus: ChartEventBus;

  constructor(area: HTMLElement) {
    this.options = { ...DEFAULT_OPTIONS };

    this.core = new ChartCore(this);

    this.utils = new ChartUtils(this);

    this.api = new ChartApi(this);

    this.timeScale = new ChartTimeScale(this);

    this.priceScale = new ChartPriceScale(this);

    this.area = area;

    this.hoverArea = HoverArea.None;

    this.dragMode = DragMode.None;

    this.hasData = false;

    this._series = new Map<string, AnyChartSeries>();

    this._running = false;

    this._rafId = 0;

    this.barWidth = DEFAULT_BAR_W;

    this.rightPadBars = 20;

    this.viewStart = 0;

    this.viewEnd = 0;

    this.dirty = true;

    this.timeAxisDirty = true;

    this.overlayDirty = true;

    this.mouse = { x: 0, y: 0, inside: false };

    this.panOrigin = {
      x: 0,
      y: 0,
      viewStart: 0,
      viewEnd: 0,
      priceMin: 0,
      priceMax: 0,
      barWidth: 0,
    };

    this.priceViewport = {
      auto: true,
      min: 0,
      max: 0,
    };

    this._liveMode = false;

    this._drawingModules = new Map();

    this._pointerClaimed = false;

    this.drawingsDirty = true;

    this._dmEventHandlers = {};

    this.panes = {} as ChartPanes;

    this.chartW = 0;

    this._abortController = new AbortController();

    this._eventBus = new ChartEventBus();

    this._init();
  }

  _init() {
    this.core.loadCssVariables();
    this.core.buildLayout();
    this.core.grabCanvases();
    this.core.resize();
    this.core.bindEvents();
    this.core.startLoop();
  }

  get data() {
    return this._series.values().next().value?.data || [];
  }

  /**
   * Returns the inferred chart interval in seconds.
   *
   * The interval is calculated from the first two bars of the
   * primary series. If there are fewer than two bars, zero is returned.
   *
   * @returns Bar interval in seconds.
   */
  public get interval(): number {
    return this._series.values().next().value?.interval || 0;
  }

  get primarySeries(): AnyChartSeries {
    return this._series.values().next().value!;
  }

  /**
   * Subscribes to global chart events.
   *
   * The listener receives every event dispatched by the entire chart
   * engine, including events originating from all chart series
   * (e.g. series data, visibility, parameters, add/remove).
   *
   * @param listener - Listener invoked for every chart event.
   * @returns An unsubscribe function.
   *
   * @example
   * const unsubscribe = chart.subscribe((event) => {
   *   if (event.type === "series:params") {
   *     console.log(event.seriesId, event.params);
   *   }
   * });
   */
  public subscribe(listener: ChartEventListener): () => void {
    return this._eventBus.subscribe(listener);
  }

  /**
   * Removes a previously registered chart event listener.
   *
   * @param listener - Listener to remove.
   */
  public unsubscribe(listener: ChartEventListener): void {
    this._eventBus.unsubscribe(listener);
  }

  /**
   * Dispatches an event to every chart subscriber.
   *
   * This method is used internally by the engine and by series to
   * broadcast events to all subscribed listeners.
   *
   * @param event - Event to dispatch.
   */
  public emit(event: ChartEvent): void {
    this._eventBus.emit(event);
  }
}
