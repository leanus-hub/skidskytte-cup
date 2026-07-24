# Region Syd Skidskytte Cup – version 6.0

Ren installation med globala klasser och klubbar.

## Installation

1. Öppna Supabase → SQL Editor.
2. Kör hela `supabase/INSTALL_V6_RESET.sql` på en gång.
3. Kontrollera att sista resultatet visar `classes = 13`, `results = 0` och `classes_has_cup_id = 0`.
4. Kontrollera att din användare fortfarande har `is_admin = true` i tabellen `profiles`.
5. Ersätt filerna i GitHub med innehållet i denna ZIP.
6. Vänta tills Vercel har driftsatt och skapa sedan cup och tävlingar på nytt.
7. Importera och granska varje tävling innan publicering.

## Viktigt

- SQL-filen raderar all tidigare cupdata men bevarar Supabase Auth-användare och befintliga profil/adminrader.
- Klasser är globala och tabellen `classes` har ingen `cup_id`.
- Klubbar är globala och återanvänds i alla cuper.
- Okända klasser stoppar importen tills ett klassalias har lagts till i admin.
- Okända klubbar skapas som externa (`is_region_club = false`) och ger inga poäng förrän de har godkänts i databasen.
