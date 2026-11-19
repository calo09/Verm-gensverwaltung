// Wendet beim Build auf Vercel die Datenbank-Migrationen an. Lokal und in der CI passiert nichts.
// Vercel nutzt bei Next.js-Projekten das normale "build"-Skript, deshalb steckt der Schritt hier.
import { execSync } from "node:child_process";

if (!process.env.VERCEL) {
  console.log("Migrationen übersprungen (nicht auf Vercel).");
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt. Bitte in Vercel unter Storage eine Neon-Datenbank mit dem Präfix DATABASE verbinden.");
  process.exit(1);
}

// Migrationen über die direkte (nicht gepoolte) Verbindung.
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
