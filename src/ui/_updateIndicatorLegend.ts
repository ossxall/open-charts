import type { ChartEngine } from "../core/ChartEngine";
import type { AnyChartSeries } from "../core/types";
import { _openSeriesSettings } from "./_openSeriesSettings";

const GEAR_ICON = `
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
`;

const TRASH_ICON = `
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
`;

/** 
 * 
 * Tracks containers that already have the delegated settings click handler. 
 * Indicator items are recreated on each update, so the click listener is 
 * bound once per container and reused through event delegation. 
 * 
 * */
const _delegationBound = new WeakSet<HTMLElement>();

/**
 * 
 * Binds the series-settings and series-delete click handlers to the
 * indicators container.
 *
 * 1. Skip the container if delegation is already attached.
 * 2. Listen for clicks and resolve the closest settings/delete button.
 * 3. Read the series id from the button's data attribute.
 * 4. Resolve the series and open its settings modal or destroy it.
 * 5. Destroying a series emits a `series:removed` event.
 * 6. The listener is tied to the engine abort signal and is removed when the engine is disposed. 
 * 
 */
function _bindSettingsDelegation(
  engine: ChartEngine,
  container: HTMLElement,
): void {
  if (_delegationBound.has(container)) return;

  _delegationBound.add(container);

  container.addEventListener(
    "click",
    (event: MouseEvent) => {
      const settingsTarget = (event.target as HTMLElement).closest<HTMLElement>(
        ".chart-indicators-item-settings",
      );

      if (settingsTarget && settingsTarget.dataset.seriesId) {
        event.stopPropagation();

        const series = engine._series.get(settingsTarget.dataset.seriesId);

        if (series) {
          _openSeriesSettings(engine, series);
        }

        return;
      }

      const deleteTarget = (event.target as HTMLElement).closest<HTMLElement>(
        ".chart-indicators-item-delete",
      );

      if (deleteTarget && deleteTarget.dataset.seriesId) {
        event.stopPropagation();

        const series = engine._series.get(deleteTarget.dataset.seriesId);

        if (series) {
          // Emits a `series:removed` event to every chart subscriber.
          series.destroy();
        }
      }
    },
    { signal: engine._abortController.signal },
  );
}

/**
 * 
 * Updates the indicator legend for the current bar.
 * 1. Resolve the indicators container and ensure settings delegation is bound.
 * 2. Iterate over all registered series.
 * 3. Build the legend values for the current bar using the series definition.
 * 4. Create the legend item if it does not exist.
 * 5. Refresh its content, visibility state, and settings button.
 * 6. Existing legend items are reused when possible. The settings button stores 
 * the series id so the delegated click handler can resolve the corresponding
 * series and open its settings modal. 
 * 
 */
export function _updateIndicatorLegend(
  engine: ChartEngine,
  barIndex: number,
): void {
  const container = engine.indicatorsDiv;

  if (!container) return;

  _bindSettingsDelegation(engine, container);

  engine._series.forEach((series: AnyChartSeries) => {
    const { def, enabled, data, values } = series;

    const id = `chart-indicators-item-${def.id}`;
    let item = container.querySelector<HTMLElement>(`#${id}`);

    const opacity = enabled ? "1" : "0.4";
    const title = enabled ? "Click to hide" : "Click to show";

    const legend = def.legend?.(data, values, barIndex, series.params) ?? [];

    const legendHtml = legend
      .map(
        (v) => `
      <span class="chart-indicators-item-label">
        ${v.label}:
      </span>
      <span
        class="chart-indicators-item-value"
        ${v.color ? `style="color:${v.color}"` : ""}
      >
        ${v.value}
      </span>
    `,
      )
      .join(" ");

    if (!item) {
      item = document.createElement("div");
      item.id = id;
      item.className = "chart-indicators-item";
      item.style.cursor = "pointer";

      item.addEventListener("click", () => {
        // engine.api?.toggleSeries(def.id);
      });

      container.appendChild(item);
    }

    item.innerHTML = `
      <span class="chart-indicators-item-name">
        ${def.label}
      </span>

      ${legendHtml}

      <button
        type="button"
        class="chart-indicators-item-settings"
        title="Configure series"
        data-series-id="${def.id}"
      >
        ${GEAR_ICON}
      </button>

      <button
        type="button"
        class="chart-indicators-item-delete"
        title="Delete series"
        data-series-id="${def.id}"
      >
        ${TRASH_ICON}
      </button>
    `;

    item.style.opacity = opacity;
    item.title = title;
  });
}
