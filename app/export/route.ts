import { requireUser } from "@/lib/auth";
import { ASSET_TYPE_LABELS } from "@/lib/assetTypes";
import { db } from "@/lib/db";
import { isoDay } from "@/lib/format";

const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export async function GET() {
  const user = await requireUser();
  const rows = await db.valuation.findMany({
    where: { asset: { userId: user.id } },
    include: { asset: true },
    orderBy: [{ date: "asc" }, { asset: { name: "asc" } }],
  });
  // Semikolon und Dezimalkomma, damit Excel in deutscher Einstellung die Datei direkt öffnet.
  const lines = [
    "Datum;Position;Art;Institut;Wert;Waehrung;Quelle",
    ...rows.map((r) =>
      [
        isoDay(r.date),
        cell(r.asset.name),
        cell(ASSET_TYPE_LABELS[r.asset.type]),
        cell(r.asset.institution ?? ""),
        r.value.toFixed(2).replace(".", ","),
        r.asset.currency,
        r.source,
      ].join(";"),
    ),
  ];
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vermoegen-${isoDay(new Date())}.csv"`,
    },
  });
}
