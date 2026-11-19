export type Point = { time: number; value: number };

/** Einfacher gleitender Durchschnitt über `n` Schlusskurse. */
export function sma(closes: Point[], n: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  closes.forEach((p, i) => {
    sum += p.value;
    if (i >= n) sum -= closes[i - n].value;
    if (i >= n - 1) out.push({ time: p.time, value: sum / n });
  });
  return out;
}

/** Exponentieller gleitender Durchschnitt, Start mit dem SMA der ersten `n` Werte. */
export function ema(closes: Point[], n: number): Point[] {
  if (closes.length < n) return [];
  const k = 2 / (n + 1);
  let prev = closes.slice(0, n).reduce((s, p) => s + p.value, 0) / n;
  const out: Point[] = [{ time: closes[n - 1].time, value: prev }];
  for (let i = n; i < closes.length; i++) {
    prev = closes[i].value * k + prev * (1 - k);
    out.push({ time: closes[i].time, value: prev });
  }
  return out;
}

/** Relative Stärke nach Wilder (Standard 14 Perioden), Werte 0–100. */
export function rsi(closes: Point[], n = 14): Point[] {
  if (closes.length <= n) return [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i].value - closes[i - 1].value;
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  const value = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  const out: Point[] = [{ time: closes[n].time, value: value() }];
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i].value - closes[i - 1].value;
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out.push({ time: closes[i].time, value: value() });
  }
  return out;
}

/** Bollinger-Bänder: SMA ± k Standardabweichungen. */
export function bollinger(closes: Point[], n = 20, k = 2) {
  const mid = sma(closes, n);
  const upper: Point[] = [];
  const lower: Point[] = [];
  mid.forEach((m, j) => {
    const window = closes.slice(j, j + n);
    const sd = Math.sqrt(window.reduce((s, p) => s + (p.value - m.value) ** 2, 0) / n);
    upper.push({ time: m.time, value: m.value + k * sd });
    lower.push({ time: m.time, value: m.value - k * sd });
  });
  return { mid, upper, lower };
}
