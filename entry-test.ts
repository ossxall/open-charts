import { createChart } from "./src/index";
import { ADX } from "./playground/series/ADX/ADX";

const area = document.getElementById("chart") as HTMLElement;

const chart = createChart(area);

chart.api.applyOptions({ legend: "SYM 5m" });

chart.api.addSeries(
  ADX({
    id: "adx-5m-1",
    label: "ADX 14",
    color: "#2962FF",
    layer: "foreground",
    priceTagColor: "#2962FF",
    params: {
      dilen: { value: 14, affectsCompute: true, min: 1, max: 200, step: 1 },
      adxlen: { value: 14, affectsCompute: true, min: 1, max: 200, step: 1 },
      key_level: { value: 23, affectsCompute: true, min: 1, max: 100, step: 1 },
    },
  }),
);

window.setTimeout(() => {
  window.document.title = "DONE";
}, 1000);