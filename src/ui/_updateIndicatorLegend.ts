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

// Containers that already have the settings click delegation attached.
const _delegationBound = new WeakSet<HTMLElement>();

/**
 * Binds a single click delegation handler on the indicators container.
 *
 * The items themselves are re-created on every frame, so the click
 * handling is attached once per container and triggers the series
 * settings modal based on the clicked button data.
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
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        ".chart-indicators-item-settings",
      );

      if (!target || !target.dataset.seriesId) return;

      event.stopPropagation();

      const series = engine._series.get(target.dataset.seriesId);

      if (series) {
        _openSeriesSettings(engine, series);
      }
    },
    { signal: engine._abortController.signal },
  );
}

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
    `;

    item.style.opacity = opacity;
    item.title = title;
  });
}
