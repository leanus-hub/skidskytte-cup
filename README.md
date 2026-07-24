# Regioncup Skidskytte – adminversion

Den här versionen innehåller:

- säker administratörsinloggning med Supabase Auth
- skapande av sommar- och vintercuper
- registrering av deltävlingar med BiathlonTiming-länk
- listor över skapade cuper och deltävlingar
- befintlig publik cupställning

## Uppdatera databasen

Öppna **Supabase → SQL Editor**, klistra in hela innehållet i:

`supabase/migrations/001_admin_and_cups.sql`

och klicka **Run**. Skriptet behåller dina befintliga säsonger och klubbar.

## Skapa ditt administratörskonto

1. Öppna **Supabase → Authentication → Users**.
2. Klicka **Add user → Create new user**.
3. Ange din e-postadress och ett starkt lösenord. Markera att användaren är bekräftad.
4. Öppna SQL Editor och kör följande, med din riktiga e-postadress:

```sql
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and u.email = 'DIN-EPOSTADRESS';
```

Kontrollera sedan:

```sql
select u.email, p.display_name, p.is_admin
from auth.users u
join public.profiles p on p.id = u.id;
```

## Lägg upp versionen på GitHub

Ladda upp alla filer från projektmappen till samma GitHub-repository. Välj att ersätta filer med samma namn och gör en commit. Vercel bygger och publicerar automatiskt.

Vercels befintliga miljövariabler ska vara kvar:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Användning

1. Öppna `/admin` på webbplatsen.
2. Logga in.
3. Skapa exempelvis **Syd Cup Vinter 2026**.
4. Lägg till en deltävling och klistra in dess BiathlonTiming-länk.

Deltävlingen sparas först som **Utkast**. Nästa utvecklingssteg är att läsa själva resultatdatan, förhandsgranska klubbmatchningen och publicera cuppoängen.
