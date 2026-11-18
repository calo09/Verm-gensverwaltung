export const ASSET_TYPES = [
  "GIROKONTO",
  "TAGESGELD",
  "DEPOT",
  "KRYPTO",
  "IMMOBILIE",
  "SONSTIGES",
  "KREDIT",
] as const;

export type AssetTypeKey = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetTypeKey, string> = {
  GIROKONTO: "Girokonto",
  TAGESGELD: "Tagesgeld / Festgeld",
  DEPOT: "Depot / Aktien / ETFs",
  KRYPTO: "Krypto",
  IMMOBILIE: "Immobilie",
  SONSTIGES: "Bargeld / Sonstiges",
  KREDIT: "Kredit / Schulden",
};

export const LIABILITY_TYPES: ReadonlySet<AssetTypeKey> = new Set(["KREDIT"]);

export function isLiability(type: AssetTypeKey) {
  return LIABILITY_TYPES.has(type);
}
