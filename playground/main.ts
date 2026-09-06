import { decode } from "@msgpack/msgpack";
import { createChart } from "../src/index";
import { ADXSeries } from "./series/ADXSeries/ADXSeries";
import { CandleBubbleSeries } from "./series/CandleBubbleSeries/CandleBubbleSeries";
import { EMASeries } from "./series/EMASeries/EMASeries";
import { SqueezeSeries } from "./series/Squeeze/SqueezeSeries";

let chart1 = createChart(document.getElementById("chart-area")!);
chart1.api.applyOptions({ legend: "Bitcoin/Tether USD · 4h" });
const chart1_candles = chart1.api.addSeries(CandleBubbleSeries);

const fakeData = [
  {
    time: 1785280680,
    open: 63604.0,
    high: 63611.9,
    low: 63604.0,
    close: 63611.9,
    volume: 13.385999999999965,
    start_ts: 1785280680000,
    end_ts: 1785280740000,
  },
  {
    time: 1785280740,
    open: 63611.9,
    high: 63612.0,
    low: 63600.0,
    close: 63600.1,
    volume: 74.86900000000011,
    start_ts: 1785280740000,
    end_ts: 1785280800000,
  },
  {
    time: 1785280800,
    open: 63600.1,
    high: 63630.9,
    low: 63596.8,
    close: 63607.5,
    volume: 140.6930000000017,
    start_ts: 1785280800000,
    end_ts: 1785280860000,
  },
  {
    time: 1785280860,
    open: 63607.6,
    high: 63607.6,
    low: 63607.5,
    close: 63607.5,
    volume: 40.31200000000004,
    start_ts: 1785280860000,
    end_ts: 1785280920000,
  },
  {
    time: 1785280920,
    open: 63607.6,
    high: 63607.6,
    low: 63607.5,
    close: 63607.6,
    volume: 23.334000000000042,
    start_ts: 1785280920000,
    end_ts: 1785280980000,
  },
];

//chart1_candles.setData(fakeData);

//let chart2 = createChart(document.getElementById("chart-area-2")!);
let chart1_pane1 = createChart(document.getElementById("pane-1")!);
let chart1_pane2 = createChart(document.getElementById("pane-2")!);

//chart2.api.applyOptions({ legend: "Bitcoin/Tether USD · 30m" });

chart1_pane1.api.applyOptions({ legend: "ADX" });
chart1_pane2.api.applyOptions({ legend: "Squeeze" });

//const chart2_candles = chart2.api.addSeries(CandleBubbleSeries);

const chart1_ema55 = chart1.api.addSeries(
  EMASeries({
    id: "ema55",
    label: "EMA 55",
    color: "#ffb830",
    layer: "foreground",
    priceTagColor: "#ffb830",
    params: {
      lineWidth: 2,
    },
  }),
);

/** 
const chart2_ema55 = chart2.api.addSeries(
  EMASeries({
    id: "ema55_2",
    label: "EMA 55",
    color: "#ffb830",
    layer: "foreground",
    priceTagColor: "#ffb830",
    params: {
      lineWidth: 2,
    },
  }),
);
*/

const chart1_ema25 = chart1.api.addSeries(
  EMASeries({
    id: "ema25",
    label: "EMA 25",
    color: "white",
    layer: "foreground",
    priceTagColor: "white",
    params: {
      lineWidth: 1,
    },
  }),
);

/** 
const chart2_ema25 = chart2.api.addSeries(
  EMASeries({
    id: "ema25_2",
    label: "EMA 25",
    color: "white",
    layer: "foreground",
    priceTagColor: "white",
    params: {
      lineWidth: 1,
    },
  }),
);
 */
const chart1_adx = chart1_pane1.api.addSeries(
  ADXSeries({
    id: "adx",
    label: "ADX",
    color: "white",
    layer: "background",
    priceTagColor: "white",
    params: {
      diLength: 14,
      adxLength: 14,
      keyLevel: 23,
    },
  }),
);

const chart1_squeeze = chart1_pane2.api.addSeries(
  SqueezeSeries({
    id: "SqueezeSeries",
    label: "Squeeze",
    color: "white",
    layer: "background",
    priceTagColor: "white",
    params: {
      length: 20,
      mult: 2,
      lengthKC: 20,
      multKC: 1.5,
      useTrueRange: true,
    },
  }),
);
//------------------------------------------------------------------------------------

// Subscribe to global chart events (includes events from all series).
// Open an indicator's settings (gear icon) and hit Apply to see
// the `series:params` event logged here.
chart1.subscribe((event) => {
  console.log("[chart-event]", event.type, event);
});

//------------------------------------------------------------------------------------

const ws = new WebSocket("ws://localhost:3000/api/market/ws");
ws.binaryType = "arraybuffer";

ws.addEventListener("open", () => {
  console.log("Conectado al WebSocket");

  ws.send(
    JSON.stringify({
      action: "subscribe",
      engine_id: "binance-BTCUSDT",
    }),
  );
});

ws.addEventListener("message", (event) => {
  if (event.data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(event.data);

    const message: any = decode(bytes);

    const CandleSeries = message.series["CandleSeries-1"];

    //console.log(CandleSeries);

    chart1_candles.update(CandleSeries);
  } else {
    console.log(event.data);
  }
});

ws.addEventListener("close", (event) => {
  console.log(`Conexión cerrada. Código: ${event.code}`);
});

ws.addEventListener("error", (event) => {
  console.error("Error en el WebSocket:", event);
});
