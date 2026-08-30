# Changelog

## v1.0.2

- Separerade publik RLS-läsning från adminbehörighet för `races` och `results`.
- Tog bort onödig `anon` EXECUTE-rättighet på `public.is_admin()`.
- Verifierade att publika scoring- och statistikvyer fortfarande fungerar via `anon`.
- Återinförde en tydlig forward-only migrationsstruktur under `supabase/migrations/`.

## v1.0.0

- Första produktionsversion
- Säkerhetsgranskad databas
- Import
- Statistik
