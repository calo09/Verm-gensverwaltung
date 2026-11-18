import "server-only";
import { db } from "./db";
import { isoDay } from "./format";
import { summarize, type AssetInput } from "./portfolio";

export async function loadSummary(userId: string) {
  const assets = await db.asset.findMany({
    where: { userId, archived: false },
    include: { valuations: { orderBy: { date: "asc" } } },
  });
  const input: AssetInput[] = assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    institution: a.institution,
    valuations: a.valuations.map((v) => ({ date: isoDay(v.date), value: v.value.toNumber() })),
  }));
  return summarize(input, isoDay(new Date()));
}
