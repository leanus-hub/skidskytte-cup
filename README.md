# Skidskytte Cup v7.0

Ren frontend- och adminversion för befintlig Supabase-databas.

## Viktigt

- Kör ingen ren installation och radera ingen data i Supabase.
- Befintliga klasser, klassalias, föreningar, föreningsalias och resultat behålls.
- Lägg innehållet i denna mapp direkt i roten av GitHub-repot.

## Miljövariabler

Kopiera `.env.example` till `.env.local` lokalt och ange samma värden i Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## V7-förändringar

- Cuper, regioner och säsonger hämtas separat och kopplas via ID i frontend.
- Admin visar därför inte längre felaktigt “Region saknas” på grund av en PostgREST-relationsfråga.
- Cupsammanställningen visar vald cup även innan sammanställningsvyerna innehåller resultat.
- Regioner och föreningar har ett klientstyrt register med filtren Alla, region och Saknar region.
- Admin är uppdelad i separata funktioner.

## Start

```bash
npm install
npm run dev
```

## Kontroll före publicering

```bash
npm run build
```
