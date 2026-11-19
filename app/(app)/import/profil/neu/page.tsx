import { ProfileEditor } from "@/components/ProfileEditor";
import { requireUser } from "@/lib/auth";
import { listInstitutions } from "@/lib/institutions";

export default async function NewProfilePage() {
  const user = await requireUser();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Neues Import-Profil</h1>
      <ProfileEditor id={null} institutions={await listInstitutions(user.id)} />
    </div>
  );
}
