"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ASSET_TYPES } from "@/lib/assetTypes";
import { parseAmount } from "@/lib/format";
import { updatePrices, type UpdateSummary } from "@/lib/prices/update";
import type { FormState } from "./auth";

const optional = z
  .string()
  .trim()
  .max(200)
  .transform((s) => (s === "" ? null : s));

const assetSchema = z
  .object({
    name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(120),
    type: z.enum(ASSET_TYPES, { message: "Bitte eine Art auswählen." }),
    institution: optional,
    identifier: optional,
    note: optional,
    quantity: z
      .string()
      .optional()
      .transform((s, ctx) => {
        if (!s?.trim()) return null;
        const n = parseAmount(s);
        if (n === null || n < 0) {
          ctx.addIssue({ code: "custom", message: "Bitte eine gültige Stückzahl eingeben." });
          return z.NEVER;
        }
        return n;
      }),
    autoPrice: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .superRefine((a, ctx) => {
    if (!a.autoPrice) return;
    if (a.type !== "DEPOT" && a.type !== "KRYPTO")
      ctx.addIssue({ code: "custom", message: "Automatische Kurse gibt es für Depot und Krypto." });
    else if (!a.identifier)
      ctx.addIssue({ code: "custom", message: "Für automatische Kurse bitte ISIN, Ticker oder Coin-Kürzel angeben." });
    else if (a.quantity === null) ctx.addIssue({ code: "custom", message: "Für automatische Kurse bitte die Stückzahl angeben." });
  });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum wählen.");

function readValuation(form: FormData) {
  const date = dateSchema.safeParse(form.get("date"));
  if (!date.success) return { error: date.error.issues[0].message } as const;
  const value = parseAmount(String(form.get("value") ?? ""));
  if (value === null || value < 0) return { error: "Bitte einen Betrag von 0 oder mehr eingeben." } as const;
  return { date: new Date(`${date.data}T00:00:00Z`), value } as const;
}

/** Holt eine Position nur, wenn sie dem angemeldeten Nutzer gehört. */
async function ownAsset(userId: string, assetId: string) {
  const asset = await db.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error("Position nicht gefunden.");
  return asset;
}

export async function createAsset(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = assetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Mit automatischem Kurs ist der Wert optional: er wird gleich abgerufen.
  const skipValue = parsed.data.autoPrice && !String(form.get("value") ?? "").trim();
  const valuation = skipValue ? null : readValuation(form);
  if (valuation && "error" in valuation) return { error: valuation.error };

  const asset = await db.asset.create({
    data: {
      ...parsed.data,
      userId: user.id,
      ...(valuation ? { valuations: { create: { date: valuation.date, value: valuation.value } } } : {}),
    },
  });
  if (asset.autoPrice) await updatePrices({ userId: user.id, assetId: asset.id });
  revalidatePath("/", "layout");
  redirect(`/positionen/${asset.id}`);
}

export async function updateAsset(assetId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const before = await ownAsset(user.id, assetId);
  const parsed = assetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const identifierChanged = (before.identifier ?? "") !== (parsed.data.identifier ?? "") || before.type !== parsed.data.type;
  await db.asset.update({
    where: { id: assetId },
    data: { ...parsed.data, ...(identifierChanged || !parsed.data.autoPrice ? { priceSymbol: null, priceError: null } : {}) },
  });
  if (parsed.data.autoPrice) {
    const r = await updatePrices({ userId: user.id, assetId });
    revalidatePath("/", "layout");
    if (r.failed.length) return { error: `Gespeichert, aber der Kurs konnte nicht abgerufen werden: ${r.failed[0].error}` };
    return {};
  }
  revalidatePath("/", "layout");
  return {};
}

export async function deleteAsset(assetId: string) {
  const user = await requireUser();
  await ownAsset(user.id, assetId);
  await db.asset.delete({ where: { id: assetId } });
  revalidatePath("/", "layout");
  redirect("/positionen");
}

export async function addValuation(assetId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  await ownAsset(user.id, assetId);
  const valuation = readValuation(form);
  if ("error" in valuation) return { error: valuation.error };
  // Pro Tag gibt es genau einen Wert; ein zweiter Eintrag am selben Tag ersetzt den ersten.
  await db.valuation.upsert({
    where: { assetId_date: { assetId, date: valuation.date } },
    create: { assetId, date: valuation.date, value: valuation.value },
    update: { value: valuation.value, source: "MANUAL" },
  });
  revalidatePath("/", "layout");
  return {};
}

export async function deleteValuation(valuationId: string) {
  const user = await requireUser();
  const v = await db.valuation.findFirst({ where: { id: valuationId, asset: { userId: user.id } } });
  if (!v) throw new Error("Eintrag nicht gefunden.");
  await db.valuation.delete({ where: { id: valuationId } });
  revalidatePath("/", "layout");
}

/** Kurse aller automatischen Positionen des Nutzers jetzt abrufen. */
export async function refreshPrices(): Promise<UpdateSummary> {
  const user = await requireUser();
  const summary = await updatePrices({ userId: user.id });
  revalidatePath("/", "layout");
  return summary;
}
