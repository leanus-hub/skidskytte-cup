# Biathlon Cup v6.3 – förbättrad sammanställning

Bygger vidare på den regionala v6.2-strukturen.

## Nytt på den publika sammanställningen

- Klickbara regioner
- Dashboard per cup med unika åkare, deltävlingar, klubbar och regionala starter
- Ledare i poängligan och medaljligan direkt i dashboarden
- Separata klubbflikar för Poängliga och Medaljliga
- Cupstatistik med deltagande per tävling
- Rekord för mest/minst besökta tävling, flest starter per klubb, klass och åkare
- Högsta poängsnitt för åkare
- Bästa klubb mätt i poäng per start
- Tabeller för starter per klubb och klass

## Installation

1. Databasen ska först vara migrerad till v6.2 regional-only.
2. Kör `supabase/MIGRATE_V6_3_SUMMARY_INSIGHTS.sql` i Supabase SQL Editor.
3. Lägg upp projektfilerna i GitHub och distribuera via Vercel.

Migreringen skapar endast statistikvyn `cup_race_statistics`. Den rensar inte klasser, klassalias, klubbalias, tävlingar eller resultat.

## v6.3.1 – korrigering av väljare
- Regionväljaren visar alla regioner.
- Cupväljaren visar cuper för vald region.
- Endast vald cup visas i sammanställningen.
- Tog bort den onödiga inbäddade Supabase-relationen från cupfrågan.
- Synliga felmeddelanden om regioner eller cuper inte kan hämtas.

## Version 6.4.1 – tydligare administration och färgprofil

- Ny adminstart med separata funktioner för säsong, cup, tävling, import, klassalias och föreningar.
- Föreningsregistret visas inte längre på adminstartsidan.
- Regionfilter och redigering av en förening i taget.
- Separata och tydliga knappar för att spara region och lägga till föreningsalias.
- Region- och cupval på sammanställningen använder riktiga select-komponenter i klienten.
- Ny blå/gul färgprofil inspirerad av uttrycket på skidskytte.se.
- Ingen ny SQL-migrering krävs från version 6.3.1.


## Version 6.4.1
Region- och föreningsfiltren i admin är nu klientstyrda och uppdateras direkt utan GET-formulär eller sidladdning.
