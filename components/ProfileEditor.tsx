"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveProfile } from "@/app/actions/imports";
import {
  COLUMN_LABELS,
  MODE_LABELS,
  REQUIRED_COLUMNS,
  detectDelimiter,
  guessColumns,
  interpret,
  toTable,
  type ImportConfig,
} from "@/lib/csvImport";
import { readFileText } from "@/lib/readFile";
import { ImportPreview } from "./ImportPreview";

type Props = {
  id: string | null;
  initial?: { name: string; institution: string | null; config: ImportConfig };
  institutions: string[];
};

const DEFAULT: ImportConfig = {
  mode: "BALANCE",
  encoding: "utf-8",
  delimiter: ";",
  decimal: "comma",
  dateFormat: "DD.MM.YYYY",
  skipRows: 0,
  columns: {},
};

const COLUMN_KEYS = ["date", "amount", "name", "identifier", "quantity"] as const;

export function ProfileEditor({ id, initial, institutions }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [config, setConfig] = useState<ImportConfig>(initial?.config ?? DEFAULT);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof ImportConfig>(key: K, value: ImportConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));
  const setColumn = (key: keyof ImportConfig["columns"], value: string) =>
    setConfig((c) => ({ ...c, columns: { ...c.columns, [key]: value || undefined } }));

  const table = useMemo(() => (text ? toTable(text, config) : null), [text, config]);
  const preview = useMemo(
    () => (table ? interpret(table, config, config.mode === "TRANSACTIONS" ? 0 : undefined) : null),
    [table, config],
  );

  async function loadSample(f: File, encoding = config.encoding) {
    setFile(f);
    const t = await readFileText(f, encoding);
    setText(t);
    // Beim ersten Laden Trennzeichen und Spalten vorschlagen.
    if (!initial && !config.columns.date && !config.columns.amount && !config.columns.name) {
      const delimiter = detectDelimiter(t);
      // Kopfzeile suchen: die erste Zeile, in der die Pflichtspalten erkannt werden.
      let skipRows = 0;
      for (let i = 0; i <= 10; i++) {
        const g = guessColumns(toTable(t, { delimiter, skipRows: i }).headers, config.mode);
        if (REQUIRED_COLUMNS[config.mode].every((k) => g[k])) {
          skipRows = i;
          break;
        }
      }
      const headers = toTable(t, { delimiter, skipRows }).headers;
      setConfig((c) => ({ ...c, delimiter, skipRows, decimal: delimiter === "," ? "dot" : c.decimal, columns: guessColumns(headers, c.mode) }));
    }
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveProfile(id, { name, institution, config });
      if (!res.ok) return setError(res.error);
      router.push(`/import/${res.id}`);
    });
  }

  const needed = REQUIRED_COLUMNS[config.mode];
  const headers = useMemo(() => table?.headers ?? [], [table]);

  // Passt eine Zuordnung nicht mehr zur Datei (andere Kopfzeile, andere Art), neu vorschlagen.
  useEffect(() => {
    if (!headers.length) return;
    setConfig((c) => {
      const guess = guessColumns(headers, c.mode);
      const cols = { ...c.columns };
      let changed = false;
      for (const k of COLUMN_KEYS) {
        if (!cols[k] ? REQUIRED_COLUMNS[c.mode].includes(k) : !headers.includes(cols[k]!)) {
          if (cols[k] !== guess[k]) {
            cols[k] = guess[k];
            changed = true;
          }
        }
      }
      return changed ? { ...c, columns: cols } : c;
    });
  }, [headers, config.mode]);

  return (
    <div className="space-y-4">
      <section className="card space-y-4">
        <h2 className="font-semibold">1. Bank oder Broker</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pname">Name des Profils</label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Sparkasse Girokonto" />
          </div>
          <div>
            <label className="label" htmlFor="pinst">Bank / Broker</label>
            <input id="pinst" className="input" list="institutions" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="z. B. Sparkasse" />
            <datalist id="institutions">
              {institutions.map((i) => <option key={i} value={i} />)}
            </datalist>
            <p className="mt-1 text-xs text-muted">Frei wählbar. Neue Positionen aus dem Import bekommen dieses Institut.</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pmode">Was steht in der Datei?</label>
          <select id="pmode" className="input" value={config.mode} onChange={(e) => set("mode", e.target.value as ImportConfig["mode"])}>
            {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">
            {config.mode === "BALANCE" && "Jede Zeile enthält ein Datum und den Kontostand danach (Spalte „Saldo“)."}
            {config.mode === "TRANSACTIONS" && "Jede Zeile ist eine Buchung. Beim Import gibst du den aktuellen Kontostand an, daraus wird der Verlauf berechnet."}
            {config.mode === "HOLDINGS" && "Jede Zeile ist ein Wertpapier oder Coin mit aktuellem Wert. Alle Werte gelten zu einem Stichtag."}
          </p>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">2. Beispieldatei laden</h2>
        <p className="text-sm text-muted">Lade einen Export deiner Bank. Er wird nur zum Einrichten gelesen und noch nicht importiert.</p>
        <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => e.target.files?.[0] && loadSample(e.target.files[0])} className="text-sm" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="penc">Zeichensatz</label>
            <select
              id="penc"
              className="input"
              value={config.encoding}
              onChange={async (e) => {
                const enc = e.target.value as ImportConfig["encoding"];
                set("encoding", enc);
                if (file) setText(await readFileText(file, enc));
              }}
            >
              <option value="utf-8">UTF-8</option>
              <option value="windows-1252">Windows (ä, ö, ü falsch? dann das hier)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pdel">Trennzeichen</label>
            <select id="pdel" className="input" value={config.delimiter} onChange={(e) => set("delimiter", e.target.value as ImportConfig["delimiter"])}>
              <option value=";">Semikolon ;</option>
              <option value=",">Komma ,</option>
              <option value={"\t"}>Tabulator</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pskip">Zeilen vor der Kopfzeile</label>
            <input id="pskip" className="input" type="number" min={0} max={50} value={config.skipRows} onChange={(e) => set("skipRows", Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div>
            <label className="label" htmlFor="pdec">Zahlenformat</label>
            <select id="pdec" className="input" value={config.decimal} onChange={(e) => set("decimal", e.target.value as ImportConfig["decimal"])}>
              <option value="comma">1.234,56 (deutsch)</option>
              <option value="dot">1,234.56 (englisch)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pdate">Datumsformat</label>
            <select id="pdate" className="input" value={config.dateFormat} onChange={(e) => set("dateFormat", e.target.value as ImportConfig["dateFormat"])}>
              <option value="DD.MM.YYYY">31.12.2026</option>
              <option value="DD.MM.YY">31.12.26</option>
              <option value="YYYY-MM-DD">2026-12-31</option>
              <option value="MM/DD/YYYY">12/31/2026</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">3. Spalten zuordnen</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {COLUMN_KEYS.filter((k) => needed.includes(k) || (config.mode === "HOLDINGS" && (k === "identifier" || k === "quantity"))).map((k) => (
            <div key={k}>
              <label className="label" htmlFor={`col-${k}`}>
                {COLUMN_LABELS[k]}
                {!needed.includes(k) && <span className="font-normal text-muted"> (optional)</span>}
              </label>
              {headers.length ? (
                <select id={`col-${k}`} className="input" value={config.columns[k] ?? ""} onChange={(e) => setColumn(k, e.target.value)}>
                  <option value="">– nicht zugeordnet –</option>
                  {headers.map((h, i) => <option key={`${h}-${i}`} value={h}>{h || `(Spalte ${i + 1})`}</option>)}
                </select>
              ) : (
                <input id={`col-${k}`} className="input" value={config.columns[k] ?? ""} onChange={(e) => setColumn(k, e.target.value)} placeholder="Spaltenüberschrift" />
              )}
            </div>
          ))}
        </div>
        {preview && <ImportPreview result={preview} hint={config.mode === "TRANSACTIONS" ? "Vorschau mit Endstand 0 €; den echten Kontostand gibst du beim Import an." : undefined} />}
      </section>

      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn" onClick={save} disabled={pending}>
        {pending ? "Speichern …" : "Profil speichern"}
      </button>
    </div>
  );
}
