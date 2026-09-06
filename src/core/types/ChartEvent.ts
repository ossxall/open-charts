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

import type { AnyChartSeries } from "./ChartSeries";

/** Source of a series data update. */
export type SeriesDataSource = "set" | "patch" | "update";

/**
 * Event dispatched to every chart subscriber.
 *
 * Events cover the whole engine lifecycle and every registered series,
 * so a single `subscribe()` call receives global events from anywhere
 * inside the chart.
 */
export type ChartEvent =
  | {
      type: "series:added";
      seriesId: string;
      series: AnyChartSeries;
    }
  | {
      type: "series:removed";
      seriesId: string;
      series: AnyChartSeries;
    }
  | {
      type: "series:visibility";
      seriesId: string;
      visible: boolean;
      series: AnyChartSeries;
    }
  | {
      type: "series:data";
      seriesId: string;
      source: SeriesDataSource;
      series: AnyChartSeries;
    }
  | {
      type: "series:params";
      seriesId: string;
      params: Record<string, unknown>;
      series: AnyChartSeries;
    };

/** Callback invoked for every event dispatched by the chart. */
export type ChartEventListener = (event: ChartEvent) => void;

/**
 * Generic synchronous event bus used by the chart engine.
 *
 * All registered listeners receive every dispatched event. An event is
 * dispatched to all subscribers, including events originating from any
 * chart series.
 */
export class ChartEventBus {
  private _listeners: Set<ChartEventListener> = new Set();

  /**
   * Registers a listener and returns a function that unsubscribes it.
   *
   * @param listener - Listener invoked for every chart event.
   * @returns An unsubscribe function.
   */
  public subscribe(listener: ChartEventListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Removes a previously registered listener.
   *
   * @param listener - Listener to remove.
   */
  public unsubscribe(listener: ChartEventListener): void {
    this._listeners.delete(listener);
  }

  /**
   * Dispatches an event to every registered listener.
   *
   * A failing listener does not prevent the remaining listeners from
   * receiving the event.
   *
   * @param event - Event to dispatch.
   */
  public emit(event: ChartEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[open-charts] chart event listener failed:", error);
      }
    }
  }
}
