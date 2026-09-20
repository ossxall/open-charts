import { expect, test } from "vitest";
import { ADXSeries, type ADXConfig } from "./ADXSeries";

const base: ADXConfig = {
  id: "adx",
  label: "ADX",
  color: "white",
  layer: "foreground",
  priceTagColor: "white",
  params: {
    dilen: 14,
    adxlen: 14,
    key_level: 23,
  },
};

test("factory exposes container size and backend param keys", () => {
  const series = ADXSeries(base);

  expect(series.id).toBe("adx");
  expect(series.width).toBe("100%");
  expect(series.height).toBe("500px");
  expect(series.params.dilen).toBe(14);
  expect(series.params.adxlen).toBe(14);
  expect(series.params.key_level).toBe(23);
});