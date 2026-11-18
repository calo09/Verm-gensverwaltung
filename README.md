# Vermögensverwaltung

Web-App, die die eigene Vermögenslage übersichtlich darstellt: Nettovermögen, Vermögen und Schulden, Aufteilung nach Art und Institut sowie den Verlauf über die Zeit. Werte werden zu einem Stichtag eingetragen; daraus entsteht der Verlauf automatisch.

## Funktionen (Version 1)

- Registrierung und Login mit E-Mail und Passwort, Daten strikt pro Nutzer getrennt
- Positionen anlegen, bearbeiten, löschen: Girokonto, Tagesgeld, Depot/ETF, Krypto, Immobilie, Sonstiges, Kredit
- Werte mit Datum erfassen (ein Wert pro Tag und Position), Historie bleibt erhalten
- Dashboard mit Kennzahlen, Verlauf (1 Jahr, 5 Jahre, alles), Aufteilung und Hinweis auf veraltete Werte
- Export aller Werte als CSV (Excel-tauglich, Semikolon und Dezimalkomma)

Geplant: CSV-Import von Bank und Broker, automatische Kurse, Installation als Handy-App (PWA).

## Technik

Next.js 15 (TypeScript), PostgreSQL mit Prisma, Tailwind CSS, Recharts. Die Anmeldung ist bewusst schlank gehalten: Passwort-Hash mit bcrypt, Sitzung als signiertes Token in einem HttpOnly-Cookie.

## Lokal starten

Voraussetzungen: Node.js 22 und eine PostgreSQL-Datenbank (z. B. per Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vermoegen postgres:16`).

```bash
cp .env.example .env          # Werte anpassen, SESSION_SECRET mit: openssl rand -base64 32
npm install
npm run db:migrate            # Tabellen anlegen
npm run dev                   # http://localhost:3000
```

Danach unter `/registrieren` dein Konto anlegen. Wenn nur du die App nutzen sollst, setze anschließend `ALLOW_REGISTRATION="false"`.

## Online stellen (Vercel + Neon)

1. Bei [Neon](https://neon.tech) eine Postgres-Datenbank in einer EU-Region anlegen und die Verbindungs-URL kopieren.
2. Bei [Vercel](https://vercel.com) dieses Repository importieren und die Umgebungsvariablen `DATABASE_URL`, `SESSION_SECRET` und `ALLOW_REGISTRATION` setzen.
3. Einmalig die Tabellen anlegen: lokal `DATABASE_URL=<Neon-URL> npm run db:migrate`.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktions-Build und Start |
| `npm run lint` | Typprüfung |
| `npm test` | Tests der Berechnungen |
| `npm run db:migrate` | Datenbank-Migrationen anwenden |
| `npm run db:migrate:dev` | Neue Migration nach Schema-Änderung erzeugen |
