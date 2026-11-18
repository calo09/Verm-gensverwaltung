import { notFound } from "next/navigation";
import { ProfileEditor } from "@/components/ProfileEditor";
import { requireUser } from "@/lib/auth";
import { importConfigSchema } from "@/lib/csvImport";
import { db } from "@/lib/db";
import { listInstitutions } from "@/lib/institutions";

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const profile = await db.importProfile.findFirst({ where: { id, userId: user.id } });
  if (!profile) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Profil bearbeiten</h1>
      <ProfileEditor
        id={profile.id}
        initial={{ name: profile.name, institution: profile.institution, config: importConfigSchema.parse(profile.config) }}
        institutions={await listInstitutions(user.id)}
      />
    </div>
  );
}
