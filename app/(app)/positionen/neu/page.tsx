import { requireUser } from "@/lib/auth";
import { listInstitutions } from "@/lib/institutions";
import { createAsset } from "@/app/actions/assets";
import { AssetForm } from "@/components/AssetForm";
import { isoDay } from "@/lib/format";

export default async function NewAssetPage() {
  const user = await requireUser();
  const institutions = await listInstitutions(user.id);
  return (
    <div className="card">
      <h1 className="mb-4 text-xl font-semibold">Neue Position</h1>
      <AssetForm action={createAsset} institutions={institutions} withValuation submitLabel="Position anlegen" today={isoDay(new Date())} />
    </div>
  );
}
