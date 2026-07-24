# Regioncup Skidskytte – Vercel-version

En första säker och publicerbar grund för cupställning med Next.js och Supabase.
Du behöver inte installera Node eller köra `npm install` på din dator.

## Publicera helt i webbläsaren

### 1. Återställ/skapa databasen

I Supabase: öppna **SQL Editor**, skapa en ny query och klistra in hela innehållet i:

`supabase/migrations/000_reset_and_setup.sql`

Kör skriptet en gång. Det är avsett för det nya projektet och tar bort de halvfärdiga tabellerna från tidigare försök.

### 2. Lägg projektet på GitHub

1. Skapa ett nytt tomt repository, exempelvis `skidskytte-cup`.
2. Packa upp zip-filen på datorn.
3. På GitHub-repots startsida: välj **uploading an existing file**.
4. Dra in alla filer och mappar från den uppackade mappen.
5. Välj **Commit changes**.

`.env.local` ingår inte och inga hemliga nycklar läggs i GitHub.

### 3. Importera repot till Vercel

1. Välj **Add New → Project** i Vercel.
2. Importera GitHub-repot.
3. Framework Preset ska identifieras som **Next.js**.
4. Lägg till miljövariablerna nedan före Deploy:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://rrmhcfkykefjmyhbtmnk.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = din publishable key

Markera Production, Preview och Development för båda.

5. Klicka **Deploy**.

Vercel installerar npm-paketen och bygger webbplatsen i molnet.

## Nuvarande funktioner

- Publik cupställning från Supabase.
- Mobilanpassad webb.
- Säker databasmodell med Row Level Security.
- Kontroll av BiathlonTiming-länkar och `raceId`.
- Inga hemliga servernycklar krävs i första versionen.

## Nästa steg

- Supabase-inloggning för administratörer.
- Riktig import av klasser och deltagarresultat.
- Poängregler och förhandsgranskning före publicering.
