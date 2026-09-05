# Roadmap

## v1.1

- PDF
- Sök

### v1.1.8 – Import Safety & Idempotency ✅

- Återimport av samma tävling verifierad utan dubbletter eller oavsiktliga ändringar.
- Säker hantering av felaktig eller tvetydig matchning av åkare, förening och klass verifierad.
- Importflöde och adminhantering genomgångna och verifierade.

### v1.1.9 – Feedback & Scoring Review

Prioriterade kontrollpunkter och förbättringar från användarfeedback:

1. **Poängregler för Nybörjare och 10–11 ✅**
   - Flickor Nybörjare: 0 cup-poäng.
   - Pojkar Nybörjare: 0 cup-poäng.
   - Flickor 10–11: 5 deltagarpoäng per giltigt regionalt resultat.
   - Pojkar 10–11: 5 deltagarpoäng per giltigt regionalt resultat.
   - Övriga klasser behåller ordinarie Syd Cup-poäng efter regional placering.

2. **Öppen Klass – poäng ✅**
   - Öppen Klass ger 0 cup-poäng.
   - Öppen Klass ger inga medaljer eller medaljpoäng.

3. **Träffprocent vid strukna resultat ✅**
   - Cupställningens skiljekriterium använder endast skjutresultat från deltävlingar som räknas i den individuella cupen.
   - Generell tävlingsstatistik använder alla giltiga resultat i respektive publicerad deltävling.
   - Ingen kodändring krävdes efter verifiering.

4. **Individuellt – horisontell scrollbar ✅**
   - Responsiv layout för expanderad åkare korrigerad så att detaljtabellen inte tvingar huvudtabellen bredare än nödvändigt.

5. **Result Review och regelinformation ✅**
   - Result Review använder samma poängkälla som cupens scoring engine.
   - Regelsidan är uppdaterad med de särskilda reglerna för Nybörjare, 10–11 och Öppen Klass.

### Future Rules / SydCup 2027

Följande är regelidéer för utvärdering och ska inte implementeras utan separat beslut:

- **Klubbkamp – aktiva åkare:** utvärdera om endast åkare med minst 3 starter ska bidra till klubbkampen.
- **Klubbkamp – tävlingens bredd:** utvärdera om endast deltävlingar med minst ett bestämt antal representerade föreningar, exempelvis 5, ska räknas.

## v2.0

- API
- Klubbportal
