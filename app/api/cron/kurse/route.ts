import { updatePrices } from "@/lib/prices/update";

// Täglicher Lauf (siehe vercel.json). Vercel schickt das CRON_SECRET als Bearer-Token mit.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const summary = await updatePrices();
  return Response.json(summary);
}
