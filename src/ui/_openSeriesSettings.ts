import type { ChartEngine } from "../core/ChartEngine";
import type { AnyChartSeries } from "../core/types";
import {
  _isParamDescriptor,
  _resolveParamValue,
  type ParamDescriptor,
} from "../utils/_paramValue";

//--------------------------------------------------------------------------------------------------------------------
//  SERIES SETTINGS MODAL
//
//  Vanilla HTML/CSS/TS modal used to configure the parameters of a
//  chart series. Applying the configuration updates the series params,
//  marks the chart for redraw and emits a `series:params` event.
//--------------------------------------------------------------------------------------------------------------------

const STYLE_ID = "open-charts-settings-modal-css";

const MODAL_CSS = `
.oc-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  font-family: var(--fontFamily, Inter, sans-serif);
}

.oc-settings-panel {
  width: 320px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
  overflow: auto;
  box-sizing: border-box;
  background: #131722;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  color: var(--text, #d1d4dc);
}

.oc-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.oc-settings-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #ffffff);
}

.oc-settings-close {
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: var(--textDim, #787b86);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.oc-settings-close:hover {
  color: #fff;
}

.oc-settings-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.oc-settings-empty {
  margin: 0;
  padding: 0.5rem 0;
  text-align: center;
  font-size: 12px;
  color: var(--textDim, #787b86);
}

.oc-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.oc-field-checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.oc-field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--textDim, #787b86);
}

.oc-field-input,
.oc-field-select {
  box-sizing: border-box;
  width: 100%;
  padding: 0.375rem 0.5rem;
  background: #1e222d;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--text, #d1d4dc);
  font-family: inherit;
  font-size: 12px;
}

.oc-field-checkbox .oc-field-input {
  width: auto;
}

.oc-field-input:focus,
.oc-field-select:focus {
  outline: none;
  border-color: var(--accent, #2962ff);
}

.oc-field-input[type="checkbox"] {
  accent-color: var(--accent, #2962ff);
}

.oc-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.oc-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: transparent;
  color: var(--text, #d1d4dc);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.oc-btn:hover {
  border-color: var(--accent, #2962ff);
}

.oc-btn-primary {
  border-color: var(--accent, #2962ff);
  background: var(--accent, #2962ff);
  color: #fff;
}

.oc-btn-primary:hover {
  background: var(--accentHover, #1e53e5);
}
`;

let _openModal: HTMLElement | null = null;

interface SettingsField {
  key: string;
  input: HTMLInputElement | HTMLSelectElement;
  original: unknown;
}

interface NormalizedOption {
  label: string;
  value: unknown;
}

/** Injects the modal stylesheet once per document. */
function _injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);
}

/** Normalizes `options` hints to `{ label, value }` entries. */
function _normalizeOptions(
  options: readonly unknown[] | readonly { label: string; value: unknown }[],
): NormalizedOption[] {
  return options.map((option) => {
    if (
      option !== null &&
      typeof option === "object" &&
      "value" in option
    ) {
      return {
        label: String((option as { label?: unknown; value: unknown }).label ?? option.value),
        value: (option as { value: unknown }).value,
      };
    }

    return { label: String(option), value: option };
  });
}

/** Coerces a control value back to the original parameter type. */
function _readFieldValue(
  input: HTMLInputElement | HTMLSelectElement,
  original: unknown,
): unknown {
  if (input instanceof HTMLInputElement) {
    if (input.type === "checkbox") return input.checked;

    if (input.type === "number") {
      const parsed = Number(input.value);
      return Number.isFinite(parsed) ? parsed : original;
    }
  }

  return input.value;
}

/**
 * Builds the label + control pair for a single parameter.
 */
function _buildFieldElement(
  key: string,
  field: unknown,
): { row: HTMLLabelElement; input: HTMLInputElement | HTMLSelectElement } {
  const descriptor: ParamDescriptor | undefined = _isParamDescriptor(field)
    ? field
    : undefined;

  const value = _resolveParamValue(field);
  const options = descriptor?.options
    ? _normalizeOptions(descriptor.options)
    : [];

  const row = document.createElement("label");
  row.className = "oc-field";

  const label = document.createElement("span");
  label.className = "oc-field-label";
  label.textContent = key;
  row.appendChild(label);

  let control: HTMLInputElement | HTMLSelectElement;

  if (options.length > 0) {
    const select = document.createElement("select");
    select.className = "oc-field-select";

    for (const option of options) {
      const element = document.createElement("option");
      element.value = String(option.value);
      element.textContent = option.label;
      if (String(option.value) === String(value)) element.selected = true;
      select.appendChild(element);
    }

    control = select;
  } else if (typeof value === "boolean") {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "oc-field-input";
    checkbox.checked = value;
    row.classList.add("oc-field-checkbox");
    control = checkbox;
  } else if (typeof value === "number") {
    const number = document.createElement("input");
    number.type = "number";
    number.className = "oc-field-input";
    if (descriptor?.min != null) number.min = String(descriptor.min);
    if (descriptor?.max != null) number.max = String(descriptor.max);
    number.step = descriptor?.step != null ? String(descriptor.step) : "any";
    number.value = String(value);
    control = number;
  } else {
    const text = document.createElement("input");
    text.type = "text";
    text.className = "oc-field-input";
    text.value = value == null ? "" : String(value);
    control = text;
  }

  row.appendChild(control);

  return { row, input: control };
}

/**
 * Opens the series settings modal for the given series.
 *
 * The modal lets the user edit every parameter of the series. Applying
 * the configuration calls `series.setParams()`, which updates the stored
 * params, recomputes values when needed, marks the chart for redraw and
 * emits a `series:params` event to every chart subscriber.
 *
 * @param engine Chart engine instance.
 * @param series Series to configure.
 */
export function _openSeriesSettings(
  engine: ChartEngine,
  series: AnyChartSeries,
): void {
  _injectStyles();

  // Reuse the single modal slot to avoid stacked overlays.
  if (_openModal) _openModal.remove();

  const overlay = document.createElement("div");
  overlay.className = "oc-settings-overlay";

  const close = (): void => {
    window.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (_openModal === overlay) _openModal = null;
  };

  //--------------------------------------------------------------------
  //  HEADER
  //--------------------------------------------------------------------
  const header = document.createElement("header");
  header.className = "oc-settings-header";

  const title = document.createElement("span");
  title.className = "oc-settings-title";
  title.textContent = `${series.def.label} · Settings`;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "oc-settings-close";
  closeButton.title = "Close";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", close);

  header.append(title, closeButton);

  //--------------------------------------------------------------------
  //  BODY
  //--------------------------------------------------------------------
  const body = document.createElement("div");
  body.className = "oc-settings-body";

  const entries = Object.entries(series.params as Record<string, unknown>);
  const fields: SettingsField[] = [];

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "oc-settings-empty";
    empty.textContent = "This series has no configurable parameters.";
    body.appendChild(empty);
  } else {
    for (const [key, field] of entries) {
      const { row, input } = _buildFieldElement(key, field);
      body.appendChild(row);
      fields.push({ key, input, original: _resolveParamValue(field) });
    }
  }

  //--------------------------------------------------------------------
  //  FOOTER
  //--------------------------------------------------------------------
  const apply = (): void => {
    const patch: Record<string, unknown> = {};

    for (const field of fields) {
      patch[field.key] = _readFieldValue(field.input, field.original);
    }

    // Updates params, recomputes if needed, marks dirty and emits
    // a `series:params` event.
    series.setParams(patch as Partial<typeof series.params>);

    close();
  };

  const footer = document.createElement("footer");
  footer.className = "oc-settings-footer";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "oc-btn";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", close);

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "oc-btn oc-btn-primary";
  applyButton.textContent = "Apply";
  applyButton.addEventListener("click", apply);

  footer.append(cancelButton, applyButton);

  //--------------------------------------------------------------------
  //  ASSEMBLE
  //--------------------------------------------------------------------
  const panel = document.createElement("div");
  panel.className = "oc-settings-panel";
  panel.append(header, body, footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  window.addEventListener("keydown", onKeydown);

  overlay.addEventListener("click", (event: MouseEvent) => {
    if (event.target === overlay) close();
  });

  _openModal = overlay;

  // Focus the first editable control.
  body.querySelector<HTMLInputElement | HTMLSelectElement>(
    "input, select",
  )?.focus();
}
