import "server-only";
import { db } from "./db";

/** Alle Institute, die der Nutzer schon verwendet, für Vorschläge in Eingabefeldern. */
export async function listInstitutions(userId: string) {
  const [a, p] = await Promise.all([
    db.asset.findMany({ where: { userId, institution: { not: null } }, select: { institution: true }, distinct: ["institution"] }),
    db.importProfile.findMany({ where: { userId, institution: { not: null } }, select: { institution: true }, distinct: ["institution"] }),
  ]);
  return [...new Set([...a, ...p].map((x) => x.institution!).filter(Boolean))].sort((x, y) => x.localeCompare(y, "de"));
}
