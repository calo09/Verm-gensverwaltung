"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { runImport } from "@/app/actions/imports";
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetTypeKey } from "@/lib/assetTypes";
import { interpret, toTable, type ImportConfig } from "@/lib/csvImport";
import { parseAmount } from "@/lib/format";
import { readFileText } from "@/lib/readFile";
import { ImportPreview } from "./ImportPreview";

type Props = {
  profileId: string;
  config: ImportConfig;
  institution: string | null;
  assets: { id: string; name: string; institution: string | null }[];
  today: string;
};

export function ImportRunner({ profileId, config, institution, assets, today }: Props) {
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState<string | null>(null);
  const sameInst = assets.filter((a) => (a.institution ?? "") === (institution ?? ""));
  const [assetId, setAssetId] = useState<string>(sameInst[0]?.id ?? assets[0]?.id ?? "__new");
  const [newName, setNewName] = useState(institution ? `${institution} Konto` : "");
  const [newType, setNewType] = useState<AssetTypeKey>(config.mode === "HOLDINGS" ? "DEPOT" : "GIROKONTO");
  const [endBalanceRaw, setEndBalanceRaw] = useState("");
  const [date, setDate] = useState(today);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; assetId?: string } | null>(null);
  const [pending, start] = useTransition();

  const endBalance = parseAmount(endBalanceRaw) ?? undefined;
  const result = useMemo(
    () => (text ? interpret(toTable(text, config), config, config.mode === "TRANSACTIONS" ? endBalance ?? 0 : undefined) : null),
    [text, config, endBalance],
  );
  const hasData = result && (result.mode === "HOLDINGS" ? result.holdings.length > 0 : result.values.length > 0);

  function submit() {
    if (!text) return;
    setMsg(null);
    start(async () => {
      const res = await runImport(profileId, {
        fileName,
        text,
        ...(config.mode === "HOLDINGS"
          ? { date, holdingsType: newType }
          : assetId === "__new"
            ? { newAsset: { name: newName, type: newType } }
            : { assetId }),
        ...(config.mode === "TRANSACTIONS" ? { endBalance } : {}),
      });
      setMsg(res.ok ? { ok: true, text: res.message ?? "Importiert.", assetId: res.id } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Datei wählen</h2>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setMsg(null);
            setFileName(f.name);
            setText(await readFileText(f, config.encoding));
          }}
        />
      </section>

      {text && (
        <section className="card space-y-4">
          <h2 className="font-semibold">Wohin sollen die Werte?</h2>
          {config.mode === "HOLDINGS" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="idate">Stichtag der Übersicht</label>
                <input id="idate" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="itype">Art für neue Positionen</label>
                <select id="itype" className="input" value={newType} onChange={(e) => setNewType(e.target.value as AssetTypeKey)}>
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                Positionen werden über die Kennung (ISIN) oder den Namen wiedererkannt. Unbekannte werden neu angelegt.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="iasset">Position</label>
                <select id="iasset" className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.institution ? ` · ${a.institution}` : ""}</option>
                  ))}
                  <option value="__new">+ Neue Position anlegen</option>
                </select>
              </div>
              {assetId === "__new" && (
                <>
                  <div>
                    <label className="label" htmlFor="iname">Name der neuen Position</label>
                    <input id="iname" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="itype2">Art</label>
                    <select id="itype2" className="input" value={newType} onChange={(e) => setNewType(e.target.value as AssetTypeKey)}>
                      {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                </>
              )}
              {config.mode === "TRANSACTIONS" && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="iend">Kontostand nach der letzten Buchung in der Datei (€)</label>
                  <input id="iend" className="input" inputMode="decimal" value={endBalanceRaw} onChange={(e) => setEndBalanceRaw(e.target.value)} placeholder="z. B. 3.320,10" />
                  <p className="mt-1 text-xs text-muted">Steht meist im Online-Banking. Daraus wird der Stand an jedem Tag zurückgerechnet.</p>
                </div>
              )}
            </div>
          )}
          {result && <ImportPreview result={result} />}
          <p className="text-xs text-muted">Gibt es für einen Tag schon einen Wert, wird er durch den importierten ersetzt.</p>
          <button
            className="btn"
            onClick={submit}
            disabled={pending || !hasData || (config.mode === "TRANSACTIONS" && endBalance === undefined) || (assetId === "__new" && config.mode !== "HOLDINGS" && !newName.trim())}
          >
            {pending ? "Importiere …" : "Jetzt importieren"}
          </button>
          {msg && (
            <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>
              {msg.text}{" "}
              {msg.ok && (
                <Link className="text-accent" href={msg.assetId ? `/positionen/${msg.assetId}` : "/dashboard"}>
                  Ansehen
                </Link>
              )}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
