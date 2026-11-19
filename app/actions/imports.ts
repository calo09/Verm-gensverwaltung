"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ASSET_TYPES } from "@/lib/assetTypes";
import { importConfigSchema, interpret, toTable } from "@/lib/csvImport";
import { db } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen für das Profil eingeben.").max(120),
  institution: z
    .string()
    .trim()
    .max(120)
    .transform((s) => s || null),
  config: importConfigSchema,
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

export async function saveProfile(id: string | null, input: ProfileInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const missing = (["BALANCE", "TRANSACTIONS"].includes(parsed.data.config.mode) ? ["date", "amount"] : ["name", "amount"]).filter(
    (c) => !parsed.data.config.columns[c as keyof typeof parsed.data.config.columns],
  );
  if (missing.length) return { ok: false, error: "Bitte alle Pflichtspalten zuordnen." };

  if (id) {
    const own = await db.importProfile.findFirst({ where: { id, userId: user.id } });
    if (!own) return { ok: false, error: "Profil nicht gefunden." };
    await db.importProfile.update({ where: { id }, data: parsed.data });
  } else {
    const created = await db.importProfile.create({ data: { ...parsed.data, userId: user.id } });
    id = created.id;
  }
  revalidatePath("/import");
  return { ok: true, id };
}

export async function deleteProfile(id: string) {
  const user = await requireUser();
  await db.importProfile.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/import");
}

const runSchema = z.object({
  fileName: z.string().max(255),
  text: z.string().max(5_000_000, "Die Datei ist zu groß (maximal 5 MB)."),
  /** BALANCE/TRANSACTIONS: bestehende Position oder neue anlegen. */
  assetId: z.string().optional(),
  newAsset: z.object({ name: z.string().trim().min(1).max(120), type: z.enum(ASSET_TYPES) }).optional(),
  endBalance: z.number().optional(),
  /** HOLDINGS: Stichtag und Art für neu anzulegende Positionen. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  holdingsType: z.enum(ASSET_TYPES).optional(),
});

export type RunInput = z.infer<typeof runSchema>;

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function runImport(profileId: string, input: RunInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsedInput = runSchema.safeParse(input);
  if (!parsedInput.success) return { ok: false, error: parsedInput.error.issues[0].message };
  const run = parsedInput.data;
  const profile = await db.importProfile.findFirst({ where: { id: profileId, userId: user.id } });
  if (!profile) return { ok: false, error: "Profil nicht gefunden." };
  const config = importConfigSchema.parse(profile.config);

  // Die Datei wird hier noch einmal ausgewertet, damit nur geprüfte Werte gespeichert werden.
  const table = toTable(run.text, config);
  const result = interpret(table, config, run.endBalance);
  const today = new Date().toISOString().slice(0, 10);

  if (result.mode === "HOLDINGS") {
    if (!result.holdings.length) return { ok: false, error: result.issues[0]?.message ?? "Keine Positionen in der Datei gefunden." };
    const date = run.date ?? today;
    if (date > today) return { ok: false, error: "Der Stichtag darf nicht in der Zukunft liegen." };
    const existing = await db.asset.findMany({ where: { userId: user.id } });
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    let created = 0;
    await db.$transaction(async (tx) => {
      for (const h of result.holdings) {
        let asset =
          (h.identifier && existing.find((a) => norm(a.identifier) === norm(h.identifier))) ||
          existing.find((a) => norm(a.name) === norm(h.name) && norm(a.institution) === norm(profile.institution));
        if (!asset) {
          asset = await tx.asset.create({
            data: {
              userId: user.id,
              name: h.name,
              identifier: h.identifier,
              institution: profile.institution,
              type: run.holdingsType ?? "DEPOT",
            },
          });
          existing.push(asset);
          created++;
        }
        await tx.valuation.upsert({
          where: { assetId_date: { assetId: asset.id, date: day(date) } },
          create: { assetId: asset.id, date: day(date), value: Math.abs(h.value), source: "IMPORT" },
          update: { value: Math.abs(h.value), source: "IMPORT" },
        });
      }
      await tx.import.create({
        data: { userId: user.id, profileId, fileName: run.fileName, rowCount: result.usedRows, valuationCount: result.holdings.length },
      });
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${result.holdings.length} Positionen zum ${new Date(`${date}T00:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })} übernommen${created ? `, davon ${created} neu angelegt` : ""}.`,
    };
  }

  if (!result.values.length) return { ok: false, error: result.issues[0]?.message ?? "Keine Werte in der Datei gefunden." };
  const values = result.values.filter((v) => v.date <= today);

  let assetId = run.assetId;
  if (assetId) {
    const own = await db.asset.findFirst({ where: { id: assetId, userId: user.id } });
    if (!own) return { ok: false, error: "Position nicht gefunden." };
  } else if (!run.newAsset) {
    return { ok: false, error: "Bitte eine Position auswählen oder neu anlegen." };
  }

  await db.$transaction(async (tx) => {
    if (!assetId) {
      const a = await tx.asset.create({
        data: { userId: user.id, name: run.newAsset!.name, type: run.newAsset!.type, institution: profile.institution },
      });
      assetId = a.id;
    }
    for (const v of values) {
      await tx.valuation.upsert({
        where: { assetId_date: { assetId: assetId!, date: day(v.date) } },
        create: { assetId: assetId!, date: day(v.date), value: v.value, source: "IMPORT" },
        update: { value: v.value, source: "IMPORT" },
      });
    }
    await tx.import.create({
      data: { userId: user.id, profileId, fileName: run.fileName, rowCount: result.usedRows, valuationCount: values.length },
    });
  }, { timeout: 30_000 });
  revalidatePath("/", "layout");
  return { ok: true, id: assetId, message: `${values.length} Tageswerte aus ${result.usedRows} Zeilen übernommen.` };
}
