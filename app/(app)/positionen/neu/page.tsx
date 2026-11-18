import { createAsset } from "@/app/actions/assets";
import { AssetForm } from "@/components/AssetForm";
import { isoDay } from "@/lib/format";

export default function NewAssetPage() {
  return (
    <div className="card">
      <h1 className="mb-4 text-xl font-semibold">Neue Position</h1>
      <AssetForm action={createAsset} withValuation submitLabel="Position anlegen" today={isoDay(new Date())} />
    </div>
  );
}
