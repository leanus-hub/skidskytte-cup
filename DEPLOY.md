# Publicera v7 i ett tomt GitHub-repo

1. Radera endast filerna i GitHub-repot. Rör inte Supabase-databasen.
2. Packa upp ZIP-filen.
3. Ladda upp alla filer och mappar direkt i repots rot. `package.json` ska synas på GitHubs första sida.
4. Kontrollera i Vercel att projektet är kopplat till rätt repo och gren.
5. Vercels Root Directory ska vara tom eller `.` eftersom projektet ligger i repots rot.
6. Behåll miljövariablerna `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
7. Gör en ny deployment.

Ingen SQL ska köras för denna kodversion.
