import type { ChartEngine } from "./ChartEngine";

export type PriceRange = {
  lo: number;
  hi: number;
};

export function _visiblePriceRange(engine: ChartEngine): PriceRange {
  // Use the manually panned price viewport when auto scaling is disabled.
  if (!engine.priceViewport.auto) {
    return {
      lo: engine.priceViewport.min,
      hi: engine.priceViewport.max,
    };
  }

  const data = engine.data;

  if (!data.length) {
    return { lo: 0, hi: 1 };
  }

  const vs = Math.max(0, engine.viewStart);
  const ve =
    engine.viewEnd === 0 ? data.length : Math.min(data.length, engine.viewEnd);

  let lo: number;
  let hi: number;

  const primary = engine.primarySeries;

  if (primary.def.valueRange) {
    const range = primary.def.valueRange(
      primary.data,
      primary.values,
      vs,
      ve,
      primary.params,
    );

    lo = range.lo;
    hi = range.hi;
  } else {
    lo = Infinity;
    hi = -Infinity;

    for (let i = vs; i < ve; i++) {
      const bar: any = data[i];

      if (!bar) {
        continue;
      }

      lo = Math.min(lo, bar.low);
      hi = Math.max(hi, bar.high);
    }

    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      return { lo: 0, hi: 1 };
    }
  }

  const range = hi - lo;
  const pad = range > 0 ? range * 0.06 : Math.max(Math.abs(lo) * 0.01, 1);

  return {
    lo: lo - pad,
    hi: hi + pad,
  };
}
