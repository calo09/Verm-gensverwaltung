"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { bollinger, ema, rsi, sma, type Point } from "@/lib/indicators";
import type { History, Range } from "@/lib/prices/history";

const RANGES: Range[] = ["1T", "5T", "1M", "3M", "6M", "1J", "5J", "Max"];
const INTRADAY: Range[] = ["1T", "5T"];

const INDICATORS = {
  sma20: { label: "SMA 20", color: "#f59e0b" },
  sma50: { label: "SMA 50", color: "#8b5cf6" },
  ema20: { label: "EMA 20", color: "#06b6d4" },
  bb: { label: "Bollinger", color: "#64748b" },
  vol: { label: "Volumen", color: "#94a3b8" },
  rsi: { label: "RSI 14", color: "#ec4899" },
} as const;
type IndicatorKey = keyof typeof INDICATORS;

type ChartType = "candles" | "line" | "area";

type Props = {
  q: string;
  kind: "security" | "crypto";
  symbol?: string | null;
  /** Stückzahl, um zusätzlich den Wert des eigenen Bestands zu zeigen. */
  quantity?: number | null;
  height?: number;
};

const STORAGE_KEY = "kurschart-einstellungen";

function loadPrefs(): { type: ChartType; indicators: IndicatorKey[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { type: "candles", indicators: ["sma50", "vol"] };
}

function css(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: n < 1 ? 6 : 2 }).format(n);
  } catch {
    return `${n.toLocaleString("de-DE")} ${currency}`;
  }
};
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;

export function PriceChart({ q, kind, symbol, quantity, height = 420 }: Props) {
  const [range, setRange] = useState<Range>("1J");
  const [type, setType] = useState<ChartType>("candles");
  const [active, setActive] = useState<IndicatorKey[]>(["sma50", "vol"]);
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<{ o: number; h: number; l: number; c: number; time: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Einstellungen merken (nur in diesem Browser).
  useEffect(() => {
    const p = loadPrefs();
    setType(p.type);
    setActive(p.indicators);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, indicators: active }));
    } catch {}
  }, [type, active]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ q, kind, range, ...(symbol ? { symbol } : {}) });
    fetch(`/api/kurse?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Kurse konnten nicht geladen werden");
        setData(body);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [q, kind, symbol, range]);

  const stats = useMemo(() => {
    if (!data?.candles.length) return null;
    const first = data.candles[0];
    const last = data.candles.at(-1)!;
    const change = last.close - first.open;
    return { last: last.close, change, changePct: (change / first.open) * 100, high: Math.max(...data.candles.map((c) => c.high)), low: Math.min(...data.candles.map((c) => c.low)) };
  }, [data]);

  useEffect(() => {
    if (!box.current || !data?.candles.length) return;
    const up = css("--good", "#059669");
    const down = css("--bad", "#dc2626");
    const text = css("--muted", "#6b7280");
    const grid = css("--border", "#e5e7eb");
    const accent = css("--accent", "#2563eb");
    const intraday = INTRADAY.includes(range);

    const chart: IChartApi = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, fontSize: 12, panes: { separatorColor: grid } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: intraday, secondsVisible: false },
      localization: {
        locale: "de-DE",
        priceFormatter: (p: number) => p.toLocaleString("de-DE", { maximumFractionDigits: p < 1 ? 6 : 2, minimumFractionDigits: p < 1 ? 2 : 2 }),
      },
    });

    const t = (c: { time: number }) => c.time as UTCTimestamp;
    const closes: Point[] = data.candles.map((c) => ({ time: c.time, value: c.close }));
    const line = (pts: Point[], color: string, pane = 0, width: 1 | 2 = 2) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, pane);
      s.setData(pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      return s;
    };

    if (type === "candles") {
      const s = chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
      s.setData(data.candles.map((c) => ({ time: t(c), open: c.open, high: c.high, low: c.low, close: c.close })));
    } else if (type === "line") {
      line(closes, accent);
    } else {
      const s = chart.addSeries(AreaSeries, { lineColor: accent, topColor: `${accent}55`, bottomColor: `${accent}05`, lineWidth: 2 });
      s.setData(closes.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    if (active.includes("sma20")) line(sma(closes, 20), INDICATORS.sma20.color);
    if (active.includes("sma50")) line(sma(closes, 50), INDICATORS.sma50.color);
    if (active.includes("ema20")) line(ema(closes, 20), INDICATORS.ema20.color);
    if (active.includes("bb")) {
      const b = bollinger(closes);
      line(b.upper, INDICATORS.bb.color, 0, 1);
      line(b.lower, INDICATORS.bb.color, 0, 1);
    }
    const hasVolume = data.candles.some((c) => c.volume);
    if (active.includes("vol") && hasVolume) {
      const v = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      v.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      v.setData(data.candles.map((c) => ({ time: t(c), value: c.volume ?? 0, color: c.close >= c.open ? `${up}66` : `${down}66` })));
    }
    if (active.includes("rsi")) {
      const r = line(rsi(closes), INDICATORS.rsi.color, 1);
      r.createPriceLine({ price: 70, color: grid, lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      r.createPriceLine({ price: 30, color: grid, lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      chart.panes()[1]?.setHeight(Math.round(height * 0.22));
    }

    chart.timeScale().fitContent();

    const byTime = new Map(data.candles.map((c) => [c.time, c]));
    const onMove = (p: MouseEventParams) => {
      const c = p.time !== undefined ? byTime.get(p.time as number) : undefined;
      setHover(c ? { o: c.open, h: c.high, l: c.low, c: c.close, time: c.time } : null);
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
    };
  }, [data, type, active, range, height]);

  const toggle = (k: IndicatorKey) => setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const cur = data?.currency ?? "EUR";
  const fmtTime = (s: number) =>
    new Date(s * 1000).toLocaleString("de-DE", INTRADAY.includes(range) ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" });

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {data?.name && <span className="font-medium text-text">{data.name} · </span>}
            {data?.symbol.replace("coingecko:", "")}
          </p>
          {stats && (
            <p className="text-2xl font-semibold tabular-nums">
              {money(stats.last, cur)}{" "}
              <span className={`text-sm ${stats.change >= 0 ? "text-good" : "text-bad"}`}>
                {pct(stats.changePct)} ({range})
              </span>
            </p>
          )}
          {stats && quantity ? (
            <p className="text-xs text-muted">
              Dein Bestand: {quantity.toLocaleString("de-DE", { maximumFractionDigits: 10 })} × {money(stats.last, cur)} = {money(quantity * stats.last, cur)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2 py-1 text-xs ${range === r ? "bg-accent text-white" : "text-muted hover:text-text"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <div className="w-28">
          <select className="input py-1 text-xs" value={type} onChange={(e) => setType(e.target.value as ChartType)} aria-label="Darstellung">
            <option value="candles">Kerzen</option>
            <option value="line">Linie</option>
            <option value="area">Fläche</option>
          </select>
        </div>
        {(Object.keys(INDICATORS) as IndicatorKey[]).map((k) => (
          <button
            key={k}
            onClick={() => toggle(k)}
            className={`rounded-full border px-2 py-1 ${active.includes(k) ? "border-transparent text-white" : "border-border text-muted hover:text-text"}`}
            style={active.includes(k) ? { background: INDICATORS[k].color } : undefined}
          >
            {INDICATORS[k].label}
          </button>
        ))}
      </div>

      <div className="mb-1 h-4 text-xs tabular-nums text-muted">
        {hover
          ? `${fmtTime(hover.time)} · O ${money(hover.o, cur)} · H ${money(hover.h, cur)} · T ${money(hover.l, cur)} · S ${money(hover.c, cur)}`
          : stats && `Zeitraum: Hoch ${money(stats.high, cur)} · Tief ${money(stats.low, cur)}`}
      </div>

      <div className="relative" style={{ height }}>
        <div ref={box} className="absolute inset-0" />
        {(loading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 text-sm">
            {loading ? <span className="text-muted">Lade Kurse …</span> : <span className="text-bad">{error}</span>}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Kurse: {kind === "crypto" ? "CoinGecko" : "Yahoo Finance"}, ggf. verzögert. Keine Anlageberatung.
      </p>
    </div>
  );
}
