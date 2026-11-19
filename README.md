# Vermögensverwaltung

Web-App, die die eigene Vermögenslage übersichtlich darstellt: Nettovermögen, Vermögen und Schulden, Aufteilung nach Art und Institut sowie den Verlauf über die Zeit. Werte werden zu einem Stichtag eingetragen; daraus entsteht der Verlauf automatisch.

## Funktionen (Version 1)

- Registrierung und Login mit E-Mail und Passwort, Daten strikt pro Nutzer getrennt
- Positionen anlegen, bearbeiten, löschen: Girokonto, Tagesgeld, Depot/ETF, Krypto, Immobilie, Sonstiges, Kredit
- Werte mit Datum erfassen (ein Wert pro Tag und Position), Historie bleibt erhalten
- Dashboard mit Kennzahlen, Verlauf (1 Jahr, 5 Jahre, alles), Aufteilung und Hinweis auf veraltete Werte
- Export aller Werte als CSV (Excel-tauglich, Semikolon und Dezimalkomma)
- CSV-Import mit selbst angelegten Profilen pro Bank oder Broker (siehe unten)
- Automatische Kurse für Aktien, ETFs und Krypto (siehe unten)

Geplant: Installation als Handy-App (PWA).

## Automatische Kurse

Bei Positionen der Art Depot oder Krypto kann „Kurs automatisch abrufen“ aktiviert werden. Dann braucht die Position eine Kennung (ISIN oder Ticker, bei Krypto das Coin-Kürzel wie BTC) und eine Stückzahl; der Wert ist Stückzahl × aktueller Kurs in Euro.

- Quellen: Yahoo Finance für Wertpapiere (bevorzugt Xetra/europäische Börsen, Fremdwährungen werden umgerechnet) und CoinGecko für Krypto. Beide sind kostenlos und ohne Konto nutzbar; für CoinGecko kann optional ein kostenloser Demo-Schlüssel in `COINGECKO_API_KEY` hinterlegt werden.
- Abruf: per Knopf „Kurse aktualisieren“ im Dashboard und werktags um 18 Uhr automatisch über `/api/cron/kurse` (Vercel Cron, geschützt durch `CRON_SECRET`).
- Beim Depot-Import wird eine Stückzahl-Spalte übernommen; mit ISIN und Stückzahl werden Kurse danach automatisch abgerufen.

Hinweis: Die Yahoo-Schnittstelle ist inoffiziell und kann sich ändern. Der Abruf ist in `lib/prices/providers.ts` gekapselt, damit sich die Quelle leicht austauschen lässt.

## CSV-Import

Unter **Import** legst du für jede Bank oder jeden Broker einmal ein Profil an: Beispieldatei hochladen, Zeichensatz, Trennzeichen, Zahlen- und Datumsformat prüfen und die Spalten zuordnen. Die App schlägt Kopfzeile und Spalten selbst vor. Danach reicht pro Import: Profil wählen, Datei hochladen, bestätigen.

| Art der Datei | Pflichtspalten | Ergebnis |
| --- | --- | --- |
| Kontostand je Tag | Datum, Saldo | Ein Wert pro Tag für eine Position |
| Umsätze / Buchungen | Datum, Betrag | Mit dem aktuellen Kontostand wird der Stand an jedem Tag zurückgerechnet |
| Depot- oder Bestandsübersicht | Bezeichnung, Wert (optional ISIN) | Alle Positionen zu einem Stichtag; Wiedererkennung über ISIN oder Name, Unbekannte werden angelegt |

Ein erneuter Import desselben Zeitraums erzeugt keine Doppelungen: pro Position und Tag gibt es genau einen Wert.

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
2. Bei [Vercel](https://vercel.com) dieses Repository importieren und die Umgebungsvariablen `DATABASE_URL`, `SESSION_SECRET`, `ALLOW_REGISTRATION` und `CRON_SECRET` setzen.
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
