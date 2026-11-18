import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportRunner } from "@/components/ImportRunner";
import { requireUser } from "@/lib/auth";
import { MODE_LABELS, importConfigSchema } from "@/lib/csvImport";
import { db } from "@/lib/db";
import { isoDay } from "@/lib/format";

export default async function RunImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const profile = await db.importProfile.findFirst({ where: { id, userId: user.id } });
  if (!profile) notFound();
  const config = importConfigSchema.parse(profile.config);
  const assets = await db.asset.findMany({
    where: { userId: user.id, archived: false },
    select: { id: true, name: true, institution: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-4">
      <Link href="/import" className="text-sm text-muted">← Alle Profile</Link>
      <div>
        <h1 className="text-xl font-semibold">Import: {profile.name}</h1>
        <p className="text-sm text-muted">
          {profile.institution ?? "Ohne Institut"} · {MODE_LABELS[config.mode]} ·{" "}
          <Link className="text-accent" href={`/import/profil/${profile.id}`}>Profil bearbeiten</Link>
        </p>
      </div>
      <ImportRunner profileId={profile.id} config={config} institution={profile.institution} assets={assets} today={isoDay(new Date())} />
    </div>
  );
}
