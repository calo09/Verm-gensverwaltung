import Link from "next/link";
import { deleteProfile } from "@/app/actions/imports";
import { ConfirmButton } from "@/components/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { MODE_LABELS, importConfigSchema } from "@/lib/csvImport";
import { db } from "@/lib/db";

const dt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });

export default async function ImportPage() {
  const user = await requireUser();
  const [profiles, imports] = await Promise.all([
    db.importProfile.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    db.import.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10, include: { profile: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Import</h1>
          <p className="text-sm text-muted">Lege für jede Bank oder jeden Broker einmal ein Profil an und importiere danach mit zwei Klicks.</p>
        </div>
        <Link className="btn" href="/import/profil/neu">+ Neues Profil</Link>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">Deine Profile</h2>
        {profiles.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Profile. Lade dazu einen CSV-Export aus deinem Online-Banking herunter und lege ein Profil an.</p>
        ) : (
          <ul className="divide-y divide-border">
            {profiles.map((p) => {
              const mode = importConfigSchema.safeParse(p.config).data?.mode;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.institution ?? "Ohne Institut"}
                      {mode && ` · ${MODE_LABELS[mode]}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link className="btn" href={`/import/${p.id}`}>Importieren</Link>
                    <Link className="btn-ghost" href={`/import/profil/${p.id}`}>Bearbeiten</Link>
                    <form action={deleteProfile.bind(null, p.id)}>
                      <ConfirmButton message="Profil löschen? Bereits importierte Werte bleiben erhalten." className="btn-ghost text-bad">Löschen</ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {imports.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Letzte Importe</h2>
          <ul className="divide-y divide-border text-sm">
            {imports.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{i.fileName}<span className="text-muted"> · {i.profile?.name ?? "Profil gelöscht"}</span></span>
                <span className="text-muted">{i.valuationCount} Werte · {dt.format(i.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
