# Roadmap

## v1.1

- PDF
- Sök

### v1.1.8 – Import Safety & Idempotency

- Säkerställ att återimport av samma tävling inte skapar dubbletter eller oavsiktliga ändringar.
- Verifiera säker hantering av felaktig eller tvetydig matchning av åkare, förening och klass.
- Granska importflöde och adminhantering innan eventuella ändringar görs.

### v1.1.9 – Feedback & Scoring Review

Prioriterade kontrollpunkter och förbättringar från användarfeedback:

1. **FP Nybörjare – 5 poäng per start**
   - Verifiera mot gällande regelverk.
   - Implementera 5 deltagarpoäng per giltig start om regeln bekräftas.

2. **Öppen Klass – poäng**
   - Verifiera mot officiella regler innan någon ändring görs.
   - Nuvarande lokala regel är 1 deltagarpoäng per giltig start och inga medaljpoäng.

3. **Träffprocent vid strukna resultat**
   - Utred om skjutresultat från individuellt strukna tävlingar ska ingå i generell statistik.
   - Håll isär generell statistik och träffprocent som används som skiljekriterium i cupställningen.

4. **Individuellt – horisontell scrollbar**
   - Fixa responsiv layout/overflow när en åkare fälls ut så att horisontell scrollbar inte ligger kvar när innehållet får plats.

### Future Rules / SydCup 2027

Följande är regelidéer för utvärdering och ska inte implementeras utan separat beslut:

- **Klubbkamp – aktiva åkare:** utvärdera om endast åkare med minst 3 starter ska bidra till klubbkampen.
- **Klubbkamp – tävlingens bredd:** utvärdera om endast deltävlingar med minst ett bestämt antal representerade föreningar, exempelvis 5, ska räknas.

## v2.0

- API
- Klubbportal
