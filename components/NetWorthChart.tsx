"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const RANGES = [
  { key: "1J", days: 365 },
  { key: "5J", days: 365 * 5 },
  { key: "Alles", days: Infinity },
] as const;

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });
const fmtMonth = (t: number) => new Date(t).toLocaleDateString("de-DE", { timeZone: "UTC", month: "short", year: "2-digit" });
const fmtDay = (t: number) => new Date(t).toLocaleDateString("de-DE", { timeZone: "UTC" });
const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function NetWorthChart({
  history,
  today,
  title = "Nettovermögen im Verlauf",
  seriesLabel = "Nettovermögen",
}: {
  history: { date: string; net: number }[];
  today: string;
  title?: string;
  seriesLabel?: string;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("Alles");

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    if (!history.length) return [];
    const points = [...history];
    // Linie bis heute weiterführen, damit der aktuelle Stand sichtbar ist.
    if (points.at(-1)!.date < today) points.push({ date: today, net: points.at(-1)!.net });
    let shown = points;
    if (days !== Infinity) {
      const from = new Date(ts(today) - days * 864e5).toISOString().slice(0, 10);
      const before = points.filter((p) => p.date < from).at(-1);
      const inRange = points.filter((p) => p.date >= from);
      shown = before ? [{ date: from, net: before.net }, ...inRange] : inRange;
    }
    // Zeitachse in Millisekunden, damit Abstände den echten Zeitabständen entsprechen.
    return shown.map((p) => ({ t: ts(p.date), net: p.net }));
  }, [history, range, today]);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2 py-1 text-xs ${range === r.key ? "bg-accent text-white" : "text-muted hover:text-text"}`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>
      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted">
          Sobald es Werte an mindestens zwei Tagen gibt, erscheint hier der Verlauf.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmtMonth} tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--border)" minTickGap={40} />
              <YAxis tickFormatter={(v: number) => compact.format(v)} tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--border)" width={48} />
              <Tooltip
                formatter={(v: number) => [eur.format(v), seriesLabel]}
                labelFormatter={(l: number) => fmtDay(l)}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
              />
              <Area type="stepAfter" dataKey="net" stroke="var(--accent)" strokeWidth={2} fill="url(#nw)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
