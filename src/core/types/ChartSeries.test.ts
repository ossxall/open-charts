import { expect, test, vi } from "vitest";
import type { ChartEngine } from "../ChartEngine";
import { ChartSeries, type SeriesDefinition } from "./ChartSeries";

interface TestBar {
  time: number;
  value: number;
}

function createEngine() {
  const state = {
    emitted: [] as unknown[],
    scrollCalls: 0,
    resetCalls: 0,
    thumbCalls: 0,
  };

  const engine = {
    hasData: false,
    viewStart: 0,
    viewEnd: 0,
    rightPadBars: 0,
    priceViewport: { auto: true },
    dirty: false,
    overlayDirty: false,
    timeAxisDirty: false,
    timeScale: {
      resetViewport() {
        state.resetCalls += 1;
      },
      scrollToRealTime() {
        state.scrollCalls += 1;
      },
      updateScrollThumb() {
        state.thumbCalls += 1;
      },
    },
    priceScale: {
      updateLayout() {},
    },
    emit(event: unknown) {
      state.emitted.push(event);
    },
  } as unknown as ChartEngine;

  return { engine, state };
}

function createDefinition(
  compute = vi.fn((data: readonly TestBar[]) => [...data]),
  updateIncremental = vi.fn((
    data: readonly TestBar[],
    values: TestBar[],
    isNewBar: boolean,
  ) => {
    const latest = data[data.length - 1];
    if (!latest) return;

    if (isNewBar) {
      values.push(latest);
    } else {
      values[values.length - 1] = latest;
    }
  }),
) {
  return {
    def: {
      id: "test",
      label: "Test",
      color: "white",
      layer: "foreground",
      width: "100%",
      height: "100%",
      params: {},
      compute,
      updateIncremental,
    } as unknown as SeriesDefinition<TestBar, TestBar, Record<string, never>>,
    compute,
    updateIncremental,
  };
}

test("upsert incrementally appends and trims the retained window", () => {
  const { engine, state } = createEngine();
  const { def, compute, updateIncremental } = createDefinition();
  const series = new ChartSeries(engine, def, {});

  series.setData([
    { time: 1, value: 10 },
    { time: 2, value: 20 },
  ]);
  engine.viewEnd = 2;
  state.scrollCalls = 0;

  expect(series.upsert({ time: 3, value: 30 }, { maxDataPoints: 2 })).toBe(true);

  expect(series.data.map((bar) => bar.time)).toEqual([2, 3]);
  expect(series.values.map((bar) => bar.time)).toEqual([2, 3]);
  expect(compute).toHaveBeenCalledTimes(1);
  expect(updateIncremental).toHaveBeenCalledWith(
    series.data,
    series.values,
    true,
    {},
  );
  expect(state.scrollCalls).toBe(1);
});

test("upsert incrementally replaces the latest bar", () => {
  const { engine } = createEngine();
  const { def, compute, updateIncremental } = createDefinition();
  const series = new ChartSeries(engine, def, {});

  series.setData([
    { time: 1, value: 10 },
    { time: 2, value: 20 },
  ]);

  expect(series.upsert({ time: 2, value: 25 })).toBe(true);

  expect(series.data).toEqual([
    { time: 1, value: 10 },
    { time: 2, value: 25 },
  ]);
  expect(series.values.at(-1)?.value).toBe(25);
  expect(compute).toHaveBeenCalledTimes(1);
  expect(updateIncremental).toHaveBeenCalledWith(
    series.data,
    series.values,
    false,
    {},
  );
});

test("upsert recomputes when inserting or revising a historical bar", () => {
  const { engine } = createEngine();
  const { def, compute, updateIncremental } = createDefinition();
  const series = new ChartSeries(engine, def, {});

  series.setData([
    { time: 1, value: 10 },
    { time: 3, value: 30 },
  ]);

  series.upsert({ time: 2, value: 20 });
  expect(series.data.map((bar) => bar.time)).toEqual([1, 2, 3]);
  expect(series.values.map((bar) => bar.time)).toEqual([1, 2, 3]);
  expect(compute).toHaveBeenCalledTimes(2);

  series.upsert({ time: 2, value: 22 });
  expect(series.data[1]).toEqual({ time: 2, value: 22 });
  expect(series.values[1]).toEqual({ time: 2, value: 22 });
  expect(compute).toHaveBeenCalledTimes(3);
  expect(updateIncremental).not.toHaveBeenCalled();
});

test("update preserves the latest-bar contract while upsert accepts older bars", () => {
  const { engine } = createEngine();
  const { def } = createDefinition();
  const series = new ChartSeries(engine, def, {});

  series.setData([
    { time: 1, value: 10 },
    { time: 3, value: 30 },
  ]);

  expect(series.update({ time: 2, value: 20 })).toBe(false);
  expect(series.data.map((bar) => bar.time)).toEqual([1, 3]);

  expect(series.upsert({ time: 2, value: 20 })).toBe(true);
  expect(series.data.map((bar) => bar.time)).toEqual([1, 2, 3]);
});

test("upsert does not duplicate values when compute aliases the source data", () => {
  const { engine } = createEngine();
  const { def, updateIncremental } = createDefinition(
    vi.fn((data: readonly TestBar[]) => data as TestBar[]),
  );
  const series = new ChartSeries(engine, def, {});

  series.setData([{ time: 1, value: 10 }]);
  series.upsert({ time: 2, value: 20 });

  expect(series.values).toBe(series.data);
  expect(series.values.map((bar) => bar.time)).toEqual([1, 2]);
  expect(updateIncremental).not.toHaveBeenCalled();
});
