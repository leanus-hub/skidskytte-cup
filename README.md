# Syd Cup – version 4

Next.js/Supabase-app för Region Syds skidskyttecup.

## Nytt i version 4

- Importknapp per deltävling i adminpanelen.
- Hämtning från BiathlonTiming/NytaTime med flera reservkällor.
- Automatisk tolkning av klass, placering, startnummer, åkare, klubb, tid och skytte.
- Matchning mot klubbnamn och alias.
- Utomstående klubbar sparas men markeras som ej Region Syd och får inga cuppoäng.
- Återimport uppdaterar befintliga resultat.
- Publicering är spärrad tills en lyckad import har gjorts.
- Importstatus och tydligt felmeddelande visas i adminpanelen.

## Installation

1. Kör migrationerna i nummerordning. För en befintlig v3-installation behöver endast
   `supabase/migrations/003_biathlontiming_import.sql` köras.
2. Ladda upp projektets filer till GitHub.
3. Kontrollera Vercels miljövariabler mot `.env.example`.
4. Öppna `/admin`, klicka **Importera resultat**, kontrollera antalet och publicera sedan deltävlingen.

## Viktigt

BiathlonTiming är en extern tjänst utan dokumenterat publikt import-API för den här resultatsidan. Importören provar därför flera publika resultatsidor och avbryter med ett tydligt fel om formatet inte kan tolkas. Den publicerar aldrig tävlingen automatiskt.


## Version 4.8 – klassalias

1. Kör `supabase/migrations/004_class_aliases.sql` i Supabase SQL Editor.
2. Ladda sedan upp projektfilerna till GitHub.
3. Importera deltävlingen igen. Klassnamn som `Pojkar 10.11` och `Pojkar 10-11 Massstart` kopplas till `Pojkar 10-11`.
4. Fler alias kan läggas till under **Admin → Klassalias**.
