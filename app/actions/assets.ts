"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ASSET_TYPES } from "@/lib/assetTypes";
import { parseAmount } from "@/lib/format";
import type { FormState } from "./auth";

const optional = z
  .string()
  .trim()
  .max(200)
  .transform((s) => (s === "" ? null : s));

const assetSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(120),
  type: z.enum(ASSET_TYPES, { message: "Bitte eine Art auswählen." }),
  institution: optional,
  identifier: optional,
  note: optional,
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
  const valuation = readValuation(form);
  if ("error" in valuation) return { error: valuation.error };

  const asset = await db.asset.create({
    data: {
      ...parsed.data,
      userId: user.id,
      valuations: { create: { date: valuation.date, value: valuation.value } },
    },
  });
  revalidatePath("/", "layout");
  redirect(`/positionen/${asset.id}`);
}

export async function updateAsset(assetId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  await ownAsset(user.id, assetId);
  const parsed = assetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.asset.update({ where: { id: assetId }, data: parsed.data });
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
